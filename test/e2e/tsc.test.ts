// Runs the real tsc against each fixture with the built mapper. Every fixture is copied to a temp
// directory whose node_modules links back to this package, the way a user's project would install it.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

const root = join(import.meta.dirname, "../..");
const tsc = join(root, "node_modules/.bin/tsc");
let work: string;

beforeAll(() => {
  execFileSync(tsc, ["-p", "tsconfig.build.json"], { cwd: root });
  work = realpathSync(mkdtempSync(join(tmpdir(), "css-modules-mapper-")));
}, 60_000);

afterAll(() => {
  if (work) rmSync(work, { recursive: true, force: true });
});

function check(fixture: string): string[] {
  const dir = join(work, fixture);
  cpSync(join(import.meta.dirname, "fixtures", fixture), dir, { recursive: true });
  mkdirSync(join(dir, "node_modules"));
  symlinkSync(root, join(dir, "node_modules/css-modules-mapper"), "dir");
  const result = spawnSync(tsc, ["-p", ".", "--runExternalCode", "--pretty", "false"], { cwd: dir, encoding: "utf8" });
  return result.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replaceAll(dir, "<dir>"));
}

test("types classes and keyframes, skipping :global", () => {
  expect(check("basic")).toEqual([
    "app.ts(6,8): error TS2339: Property 'icon' does not exist on type '{ readonly btn: string; readonly \"btn-primary\": string; readonly spin: string; }'.",
    "app.ts(7,8): error TS2339: Property 'missing' does not exist on type '{ readonly btn: string; readonly \"btn-primary\": string; readonly spin: string; }'.",
  ]);
}, 30_000);

test("a CSS syntax error is the only error", () => {
  expect(check("broken")).toEqual(["Broken.module.css(2,1): error css-modules1: Unclosed block"]);
}, 30_000);

test("named exports with camel-case-only", () => {
  expect(check("named")).toEqual([
    "app.ts(5,8): error TS2551: Property 'btn-primary' does not exist on type 'typeof import(\"<dir>/Card.module.css\")'. Did you mean 'btnPrimary'?",
  ]);
}, 30_000);

test("bad options are reported in tsconfig.json", () => {
  const output = check("bad-options");
  expect(output).toHaveLength(1);
  expect(output[0]).toMatch(/^tsconfig\.json\(\d+,\d+\): error css-modules5: 'exportLocalsConvention' must be one of/);
}, 30_000);
