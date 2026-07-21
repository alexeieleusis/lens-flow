import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-assertion-bypass.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = resolve(__dirname, "../..");
const TS_CONFIG = join(TS_CONFIG_DIR, "tsconfig.test.json");

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

ruleTester.run("no-assertion-bypass", rule, {
  valid: [
    // Object matches target type exactly — no excess properties
    {
      filename: TEST_FILENAME,
      code: `
interface Config { mode: "dev" | "prod"; port: number }
const config = { mode: "dev" as const, port: 3000 };
function init(c: Config) {}
init(config as Config);
`,
    },
    // Using satisfies instead of as — the correct pattern
    {
      filename: TEST_FILENAME,
      code: `
interface Config { mode: "dev" | "prod"; port: number }
const config = {
  mode: "dev",
  port: 3000,
} satisfies Config;
`,
    },
    // Assertion to a wider type — inner type is a subset
    {
      filename: TEST_FILENAME,
      code: `
interface Base { a: number }
interface Extended extends Base { b: string }
const obj: Extended = { a: 1, b: "hi" };
const base = obj as Base;
`,
    },
    // Shorthand properties — shorthand identifiers resolve correctly
    {
      filename: TEST_FILENAME,
      code: `
interface Config { a: number; b: string }
const a = 1;
const b = "hi";
const config = { a, b };
const c = config as Config;
`,
    },
    // Destructured declarations — should not crash or misreport
    {
      filename: TEST_FILENAME,
      code: `
const source = { a: 1, b: "hi", extra: true };
const { a, b } = source;
const obj = { a, b };
const typed = obj as { a: number; b: string };
`,
    },
    // Nested object literals — only top-level keys are checked
    {
      filename: TEST_FILENAME,
      code: `
interface Inner { a: number }
interface Outer { inner: Inner }
const outer = { inner: { a: 1, extra: true } };
const o = outer as Outer;
`,
    },
    // Target type has index signature — excess properties are allowed
    {
      filename: TEST_FILENAME,
      code: `
interface Loose { [key: string]: unknown }
const obj = { a: 1, extra: true };
const x = obj as Loose;
`,
    },
  ],
  invalid: [
    // Excess property `debug` bypassed by `as Config`
    {
      filename: TEST_FILENAME,
      code: `
interface Config { mode: "dev" | "prod"; port: number }
const config = { mode: "dev", port: 3000, debug: true };
function init(c: Config) {}
init(config as Config);
`,
      errors: [{ messageId: "excessProps" }],
    },
    // Excess property `extra` bypassed by `as Settings`
    {
      filename: TEST_FILENAME,
      code: `
interface Settings { name: string; timeout: number }
const settings = { name: "app", timeout: 5000, extra: "leak" };
const s = settings as Settings;
`,
      errors: [{ messageId: "excessProps" }],
    },
    // Double-cast: `(obj as unknown) as Target` — excess property should still be caught
    {
      filename: TEST_FILENAME,
      code: `
interface Config { name: string }
const obj = { name: "a", extra: true };
const typed = (obj as unknown) as Config;
`,
      errors: [{ messageId: "excessProps" }, { messageId: "excessProps" }],
    },
    // TSNonNullExpression wrapper — excess property should still be caught
    {
      filename: TEST_FILENAME,
      code: `
interface Config { name: string }
const typed = ({ name: "a", extra: true }!) as Config;
`,
      errors: [{ messageId: "excessProps" }],
    },
    // TSSatisfiesExpression wrapper — excess property should still be caught
    {
      filename: TEST_FILENAME,
      code: `
interface Source { name: string; extra: boolean }
interface Config { name: string }
const obj = ({ name: "a", extra: true } satisfies Source) as Config;
`,
      errors: [{ messageId: "excessProps" }],
    },
  ],
});
