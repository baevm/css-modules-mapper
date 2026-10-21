import { describe, expect, test } from "vitest";
import { emit } from "../src/emit.ts";
import { extract } from "../src/extract.ts";
import { DEFAULT_OPTIONS, type Options, resolveOptions } from "../src/options.ts";

const run = (css: string, options: Partial<Options> = {}, encoding: "utf-8" | "utf-16" = "utf-16") =>
  emit(css, extract(css), { ...DEFAULT_OPTIONS, ...options }, encoding);

describe("emit", () => {
  test("default export object", () => {
    const result = run(".btn {} .btn-primary {}");
    expect(result.text).toBe(
      'declare const styles: {\n  readonly btn: string;\n  readonly "btn-primary": string;\n};\nexport default styles;\n',
    );
    expect(result.extension).toBe(".ts");
    expect(result.diagnostics).toBeUndefined();
  });

  test("maps each key to its class name", () => {
    const css = ".btn {} .btn-primary {}";
    const result = run(css);
    expect(result.mappings).toHaveLength(2);
    for (const [virtualStart, virtualLength, originalStart, originalLength] of result.mappings!) {
      const key = result.text.slice(virtualStart, virtualStart + virtualLength).replaceAll('"', "");
      expect(css.slice(originalStart, originalStart + originalLength)).toBe(key);
    }
  });

  test("camelCase convention adds aliases mapped to the same span", () => {
    const result = run(".btn-primary {}", { exportLocalsConvention: "camelCase" });
    expect(result.text).toContain('readonly "btn-primary": string;');
    expect(result.text).toContain("readonly btnPrimary: string;");
    const originals = result.mappings!.map((mapping) => mapping[2]);
    expect(new Set(originals).size).toBe(1);
  });

  test("named exports", () => {
    const result = run(".btn {} .btn-primary {} .class {} .default {}", { namedExports: true });
    expect(result.text).toBe(
      "export declare const btn: string;\n" +
        'declare const __0: string;\nexport { __0 as "btn-primary" };\n' +
        'declare const __1: string;\nexport { __1 as "class" };\n',
    );
    expect(result.diagnostics).toEqual([
      { messageText: "A class named 'default' can't be a named export.", start: 35, length: 7, code: 3 },
    ]);
  });

  test("empty module with named exports is still a module", () => {
    expect(run("body {}", { namedExports: true }).text).toBe("export {};\n");
  });

  test("syntax errors type the module any", () => {
    const result = run(".a {");
    expect(result.text).toBe("declare const styles: any;\nexport default styles;\n");
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 1, messageText: "Unclosed block", start: 0 })]);
  });

  test("UTF-8 positions are byte offsets", () => {
    const css = "/* ü */ .x {}";
    const [, , originalStart, originalLength] = run(css, {}, "utf-8").mappings![0];
    expect(originalStart).toBe(Buffer.byteLength("/* ü */ ."));
    expect(originalLength).toBe(1);
  });
});

describe("resolveOptions", () => {
  test("defaults", () => {
    expect(resolveOptions(undefined)).toEqual({ options: DEFAULT_OPTIONS, diagnostics: [] });
  });

  test("valid options", () => {
    expect(resolveOptions({ namedExports: true, exportLocalsConvention: "camel-case-only" }).options).toEqual({
      namedExports: true,
      exportLocalsConvention: "camelCaseOnly",
    });
  });

  test("reports bad options by path", () => {
    const { diagnostics } = resolveOptions({ namedExports: "yes", exportLocalsConvention: "kebab", extra: 1 } as never);
    expect(diagnostics.map((diagnostic) => diagnostic.path)).toEqual([["extra"], ["namedExports"], ["exportLocalsConvention"]]);
  });
});
