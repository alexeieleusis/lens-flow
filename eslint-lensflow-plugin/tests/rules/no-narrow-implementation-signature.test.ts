import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-narrow-implementation-signature.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG,
      tsconfigRootDir: TS_CONFIG_DIR,
    },
  },
});

ruleTester.run("no-narrow-implementation-signature", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function get(x: string): string;
function get(x: number): number;
function get(x: string | number): string | number {
  return typeof x === "string" ? x : x.toString();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function parse(s: string): Date;
function parse(s: string): string;
function parse(s: string): Date | string {
  return s as any;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function single(x: number): number {
  return x;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `declare function get(x: string): string;
declare function get(x: number): number;
function get(x: string | number): string | number {
  return typeof x === "string" ? x : x.toString();
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function get(x: string): string;
function get(x: number): number;
function get(x) { return "always string"; }`,
      errors: [{ messageId: "narrowImpl" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function get(x: string): string;
function get(x: number): number;
function get(x: string): string {
  return x;
}`,
      errors: [{ messageId: "narrowImpl" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function process(x: string): string;
function process(x: number): number;
function process(x: string | number): string {
  return String(x);
}`,
      errors: [{ messageId: "narrowImpl" }],
    },
    {
      filename: TEST_FILENAME,
      code: `declare function get(x: string): string;
declare function get(x: number): number;
function get(x) { return "always string"; }`,
      errors: [{ messageId: "narrowImpl" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function get(x: string): string;
function get(x: number): number;
function get(x: string | number, extra: boolean): string | number {
  return typeof x === "string" ? x : x.toString();
}`,
      errors: [{ messageId: "narrowImpl" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function get(x: string): string;
function get(x: number): number;
function get(): string | number {
  return "default";
}`,
      errors: [{ messageId: "narrowImpl" }],
    },
  ],
});
