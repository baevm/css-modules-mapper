// Finds the local names a CSS module exports: class selectors and @keyframes names.
// Offsets are JavaScript string indices into the original source; `emit.ts` converts them
// to whatever position encoding TypeScript negotiated.
import postcss, { type AtRule, type Rule } from "postcss";
import selectorParser from "postcss-selector-parser";

export interface Span {
  start: number;
  end: number;
}

export interface LocalName {
  name: string;
  /** First occurrence of the name in the source, used for go-to-definition. */
  span: Span;
}

export interface Problem {
  code: number;
  message: string;
  span: Span;
}

export interface Extracted {
  /** Local names in source order, without duplicates. Undefined when the file doesn't parse. */
  names: LocalName[] | undefined;
  problems: Problem[];
}

export const ProblemCode = {
  SyntaxError: 1,
  InvalidSelector: 2,
  NotExportable: 3,
  InvalidOption: 5,
} as const;

export function extract(css: string, fileName?: string): Extracted {
  let root: postcss.Root;
  try {
    root = postcss.parse(css, { from: fileName });
  } catch (error) {
    if (error instanceof postcss.CssSyntaxError) {
      const start = clamp(error.input?.offset ?? 0, css.length);
      const end = clamp(error.input?.endOffset ?? start + 1, css.length);
      return {
        names: undefined,
        problems: [{ code: ProblemCode.SyntaxError, message: error.reason, span: { start, end: Math.max(start, end) } }],
      };
    }
    throw error;
  }

  const names = new Map<string, Span>();
  const problems: Problem[] = [];
  const add = (name: string, span: Span) => {
    if (!names.has(name)) names.set(name, span);
  };

  root.walk((node) => {
    if (node.type === "rule") collectClasses(css, node, add, problems);
    else if (node.type === "atrule" && /(^|-)keyframes$/i.test(node.name)) collectKeyframes(css, node, add);
  });

  return {
    names: [...names].map(([name, span]) => ({ name, span })),
    problems,
  };
}

function collectClasses(css: string, rule: Rule, add: (name: string, span: Span) => void, problems: Problem[]) {
  // Keyframe selectors (`from`, `50%`) live in rules too, but never contain classes.
  if (rule.parent?.type === "atrule" && /(^|-)keyframes$/i.test((rule.parent as AtRule).name)) return;

  const ruleStart = rule.source?.start?.offset;
  if (ruleStart === undefined) return;
  const raw = (rule.raws.selector as { raw?: string } | undefined)?.raw ?? rule.selector;
  // The selector is the first thing in a rule's source. If it isn't (a parser quirk), positions
  // would be wrong, so fall back to pointing at the rule itself.
  const exact = css.startsWith(raw, ruleStart);

  let ast: { nodes: SelectorNode[] };
  try {
    ast = selectorParser().astSync(raw, { lossless: true }) as unknown as { nodes: SelectorNode[] };
  } catch (error) {
    problems.push({
      code: ProblemCode.InvalidSelector,
      message: `Invalid selector: ${error instanceof Error ? error.message : String(error)}`,
      span: { start: ruleStart, end: ruleStart + (exact ? raw.length : 1) },
    });
    return;
  }

  for (const selector of ast.nodes) {
    walkLocal(selector.nodes ?? [], true, (node) => {
      const rawName = node.raws?.value ?? node.value;
      const start = exact ? ruleStart + node.sourceIndex + 1 : ruleStart;
      add(node.value, { start, end: exact ? start + rawName.length : ruleStart + 1 });
    });
  }
}

/**
 * Visits class nodes that are local under CSS modules' rules: everything is local by default,
 * `:global(...)` / `:local(...)` scope their arguments, and a bare `:global` / `:local` switches the
 * mode for the rest of the selector.
 */
// selector-parser's own node types are too recursive for the checker, so walk a minimal shape.
interface SelectorNode {
  type: string;
  value: string;
  sourceIndex: number;
  raws?: { value?: string };
  nodes?: SelectorNode[];
}

function walkLocal(nodes: SelectorNode[], local: boolean, visit: (node: SelectorNode) => void): void {
  let mode = local;
  for (const node of nodes) {
    if (node.type === "pseudo" && (node.value === ":global" || node.value === ":local")) {
      const isLocal = node.value === ":local";
      if (node.nodes && node.nodes.length > 0) {
        for (const inner of node.nodes) walkLocal(inner.nodes ?? [], isLocal, visit);
      } else {
        mode = isLocal;
      }
    } else if (node.type === "class") {
      if (mode) visit(node);
    } else if (node.nodes) {
      // :is(), :not(), :has() and friends inherit the current mode.
      for (const inner of node.nodes) walkLocal(inner.type === "selector" ? (inner.nodes ?? []) : [inner], mode, visit);
    }
  }
}

function collectKeyframes(css: string, rule: AtRule, add: (name: string, span: Span) => void) {
  const atStart = rule.source?.start?.offset;
  if (atStart === undefined) return;
  const params = rule.params;
  const global = /^:global\(\s*(.*?)\s*\)$/.exec(params);
  if (global) return;
  const local = /^:local\(\s*(.*?)\s*\)$/.exec(params);
  const name = local ? local[1] : params;
  if (!name || /\s/.test(name)) return;

  const paramsStart = atStart + 1 + rule.name.length + (rule.raws.afterName ?? "").length;
  const nameStart = css.indexOf(name, paramsStart);
  const start = nameStart === -1 ? atStart : nameStart;
  add(name, { start, end: nameStart === -1 ? atStart + 1 : start + name.length });
}

function clamp(value: number, max: number) {
  return Math.min(Math.max(value, 0), max);
}
