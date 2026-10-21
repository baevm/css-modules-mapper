import { describe, expect, test } from "vitest";
import { extract } from "../src/extract.ts";

const names = (css: string) => extract(css).names?.map((entry) => entry.name);
const spanText = (css: string, name: string) => {
  const entry = extract(css).names?.find((candidate) => candidate.name === name);
  return entry && css.slice(entry.span.start, entry.span.end);
};

describe("extract", () => {
  test("collects classes in source order without duplicates", () => {
    expect(names(".a, .b:hover .c {} .a.d {}")).toEqual(["a", "b", "c", "d"]);
  });

  test("walks into at-rules and nesting", () => {
    expect(names("@media (min-width: 1px) { @supports (x: y) { .a { &.b { .c & {} } } } } @layer l { .d {} }")).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("respects :global and :local", () => {
    expect(names(":global(.g) .a {} :global .g2 .g3 {} :local(.b) {} :global .g4 :local(.c) {} .e :global(.g5) {}")).toEqual([
      "a",
      "b",
      "c",
      "e",
    ]);
  });

  test("looks inside functional pseudo-classes", () => {
    expect(names(".a:not(.b):is(.c, :global(.g)) {}")).toEqual(["a", "b", "c"]);
  });

  test("exports local keyframes, not global ones", () => {
    expect(names("@keyframes spin {from {} to {}} @-webkit-keyframes :local(fade) {} @keyframes :global(g) {}")).toEqual([
      "spin",
      "fade",
    ]);
    expect(spanText("@keyframes   spin {}", "spin")).toBe("spin");
  });

  test("spans point at the class name in the source", () => {
    const css = "/* c */\n.x {}\n\n@media print {\n  .btn-primary,\n  .y { }\n}";
    expect(spanText(css, "x")).toBe("x");
    expect(spanText(css, "btn-primary")).toBe("btn-primary");
    expect(spanText(css, "y")).toBe("y");
  });

  test("spans survive comments inside selectors", () => {
    const css = ".a /* hi */ .b {}";
    expect(spanText(css, "b")).toBe("b");
  });

  test("unescapes names but spans cover the escaped source", () => {
    const css = ".sm\\:flex {}";
    expect(names(css)).toEqual(["sm:flex"]);
    expect(spanText(css, "sm:flex")).toBe("sm\\:flex");
  });

  test("handles non-ASCII names", () => {
    const css = "/* ü */ .кнопка {} .😀 {}";
    expect(names(css)).toEqual(["кнопка", "😀"]);
    expect(spanText(css, "😀")).toBe("😀");
  });

  test("reports syntax errors with a position", () => {
    const css = ".a { color: red;\n.b {";
    const result = extract(css);
    expect(result.names).toBeUndefined();
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ code: 1, message: "Unclosed block" });
    expect(result.problems[0].span.start).toBeGreaterThanOrEqual(0);
  });

  test("ignores keyframe selectors", () => {
    expect(names("@keyframes k { from { } 50% { } }")).toEqual(["k"]);
  });
});
