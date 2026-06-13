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
  ],
});
