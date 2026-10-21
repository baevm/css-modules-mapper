import type { OptionDiagnostic } from "ts-content-mapper";
import { ProblemCode } from "./extract.ts";
import { CONVENTION_NAMES, type Convention, parseConvention } from "./naming.ts";

/** Options from the `contentMappers` entry in tsconfig.json. */
export interface RawOptions {
  namedExports?: unknown;
  exportLocalsConvention?: unknown;
}

export interface Options {
  namedExports: boolean;
  exportLocalsConvention: Convention;
}

export const DEFAULT_OPTIONS: Options = { namedExports: false, exportLocalsConvention: "asIs" };

export function resolveOptions(raw: RawOptions | undefined): { options: Options; diagnostics: OptionDiagnostic[] } {
  const options = { ...DEFAULT_OPTIONS };
  const diagnostics: OptionDiagnostic[] = [];
  if (raw === undefined || raw === null) return { options, diagnostics };

  for (const key of Object.keys(raw)) {
    if (key !== "namedExports" && key !== "exportLocalsConvention") {
      diagnostics.push({ path: [key], messageText: `Unknown option '${key}'.`, code: ProblemCode.InvalidOption });
    }
  }

  if (raw.namedExports !== undefined) {
    if (typeof raw.namedExports === "boolean") options.namedExports = raw.namedExports;
    else diagnostics.push({ path: ["namedExports"], messageText: "'namedExports' must be a boolean.", code: ProblemCode.InvalidOption });
  }

  if (raw.exportLocalsConvention !== undefined) {
    const convention = typeof raw.exportLocalsConvention === "string" ? parseConvention(raw.exportLocalsConvention) : undefined;
    if (convention) options.exportLocalsConvention = convention;
    else
      diagnostics.push({
        path: ["exportLocalsConvention"],
        messageText: `'exportLocalsConvention' must be one of ${CONVENTION_NAMES.map((name) => `'${name}'`).join(", ")}.`,
        code: ProblemCode.InvalidOption,
      });
  }

  return { options, diagnostics };
}
