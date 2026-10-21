// Turns extracted names into the virtual TypeScript module the checker sees, with each export
// name mapped back to its selector so hover and go-to-definition land in the CSS.
import {
  type ContentMapperDiagnostic,
  MappedCodeBuilder,
  type PositionEncoding,
  SpanMapFeature,
  type TransformResult,
  encodedLength,
  stringIndexToPosition,
} from "ts-content-mapper";
import { type Extracted, type Problem, ProblemCode } from "./extract.ts";
import { exportNames } from "./naming.ts";
import type { Options } from "./options.ts";

// Renaming through the mapping would rewrite the CSS with a TypeScript-shaped name, and the other
// editing features make no sense in generated declarations.
const FEATURES =
  SpanMapFeature.All &
  ~(SpanMapFeature.Rename | SpanMapFeature.LinkedEditing | SpanMapFeature.Formatting | SpanMapFeature.CodeActions | SpanMapFeature.AutoInsert);

export function emit(
  css: string,
  extracted: Extracted,
  options: Options,
  positionEncoding: PositionEncoding = "utf-16",
): TransformResult {
  const problems = [...extracted.problems];
  const builder = new MappedCodeBuilder(css, { positionEncoding });

  if (extracted.names === undefined) {
    // The file doesn't parse: type it `any` so its syntax error is the only error.
    builder.append("declare const styles: any;\nexport default styles;\n");
  } else {
    const entries: { key: string; start: number; end: number }[] = [];
    const seen = new Set<string>();
    for (const { name, span } of extracted.names) {
      for (const key of exportNames(name, options.exportLocalsConvention)) {
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ key, start: span.start, end: span.end });
      }
    }

    if (options.namedExports) {
      let alias = 0;
      for (const entry of entries) {
        if (entry.key === "default") {
          problems.push({
            code: ProblemCode.NotExportable,
            message: "A class named 'default' can't be a named export.",
            span: { start: entry.start, end: entry.end },
          });
          continue;
        }
        if (isDeclarableIdentifier(entry.key)) {
          builder.append("export declare const ");
          builder.appendAtom(entry.key, entry.start, entry.end, FEATURES);
          builder.append(": string;\n");
        } else {
          const local = `__${alias++}`;
          builder.append("declare const ");
          builder.appendAtom(local, entry.start, entry.end, FEATURES);
          builder.append(": string;\nexport { " + local + " as ");
          builder.appendAtom(JSON.stringify(entry.key), entry.start, entry.end, FEATURES);
          builder.append(" };\n");
        }
      }
      if (entries.length === 0) builder.append("export {};\n");
    } else {
      builder.append("declare const styles: {\n");
      for (const entry of entries) {
        builder.append("  readonly ");
        builder.appendAtom(propertyName(entry.key), entry.start, entry.end, FEATURES);
        builder.append(": string;\n");
      }
      builder.append("};\nexport default styles;\n");
    }
  }

  const output = builder.build(".ts");
  const diagnostics = problems.map((problem) => toDiagnostic(css, problem, positionEncoding));
  return diagnostics.length > 0 ? { ...output, diagnostics } : output;
}

function toDiagnostic(css: string, problem: Problem, encoding: PositionEncoding): ContentMapperDiagnostic {
  const start = stringIndexToPosition(css, problem.span.start, encoding);
  return {
    messageText: problem.message,
    start,
    length: encodedLength(css.slice(problem.span.start, problem.span.end), encoding),
    code: problem.code,
  };
}

const IDENTIFIER = /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u;

// Words that can't be the name of an `export declare const`.
const RESERVED = new Set(
  (
    "break case catch class const continue debugger default delete do else enum export extends false finally for " +
    "function if import in instanceof new null return super switch this throw true try typeof var void while with " +
    "implements interface let package private protected public static yield await arguments eval"
  ).split(" "),
);

function isDeclarableIdentifier(name: string) {
  return IDENTIFIER.test(name) && !RESERVED.has(name);
}

function propertyName(name: string) {
  return IDENTIFIER.test(name) ? name : JSON.stringify(name);
}
