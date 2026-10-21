import { expect, test } from "vitest";
import { camelCase, dashesCamelCase, exportNames, parseConvention } from "../src/naming.ts";

test("camelCase", () => {
  expect(camelCase("btn-primary")).toBe("btnPrimary");
  expect(camelCase("btn_primary--large")).toBe("btnPrimaryLarge");
  expect(camelCase("-leading")).toBe("leading");
  expect(camelCase("Header")).toBe("header");
  expect(camelCase("already")).toBe("already");
});

test("dashesCamelCase only touches dashes", () => {
  expect(dashesCamelCase("btn-primary_x")).toBe("btnPrimary_x");
});

test("exportNames per convention", () => {
  expect(exportNames("btn-primary", "asIs")).toEqual(["btn-primary"]);
  expect(exportNames("btn-primary", "camelCase")).toEqual(["btn-primary", "btnPrimary"]);
  expect(exportNames("btn", "camelCase")).toEqual(["btn"]);
  expect(exportNames("btn-primary", "camelCaseOnly")).toEqual(["btnPrimary"]);
  expect(exportNames("btn-primary", "dashes")).toEqual(["btn-primary", "btnPrimary"]);
  expect(exportNames("btn-primary", "dashesOnly")).toEqual(["btnPrimary"]);
});

test("accepts css-loader and Vite spellings", () => {
  expect(parseConvention("camel-case-only")).toBe("camelCaseOnly");
  expect(parseConvention("camelCaseOnly")).toBe("camelCaseOnly");
  expect(parseConvention("as-is")).toBe("asIs");
  expect(parseConvention("toString")).toBeUndefined();
});
