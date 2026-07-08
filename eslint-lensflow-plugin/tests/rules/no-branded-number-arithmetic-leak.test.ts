import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-branded-number-arithmetic-leak.js";

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

ruleTester.run("no-branded-number-arithmetic-leak", rule, {
  valid: [
    // Plain number arithmetic — no branded types involved
    {
      filename: TEST_FILENAME,
      code: `const a = 100;
const b = 200;
const c = a + b;`,
    },
    // Result is re-wrapped with explicit cast
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = (a + b) as Milliseconds;`,
    },
    // Result re-wrapped with angle-bracket TSTypeAssertion
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = <Milliseconds>(a + b);`,
    },
    // Result re-wrapped — single underscore _brand variant
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly _brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = (a + b) as Milliseconds;`,
    },
    // Result re-wrapped — PascalCase Brand suffix variant
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly MillisecondsBrand: unique symbol };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = (a + b) as Milliseconds;`,
    },
    // Non-arithmetic operator on branded numbers
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a === b;`,
    },
  ],
  invalid: [
    // Addition of two branded numbers (intersection style)
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;`,
      errors: [{ messageId: "leak" }],
    },
    // Subtraction of branded numbers
    {
      filename: TEST_FILENAME,
      code: `type Pixels = number & { readonly __brand: "Pixels" };
const x: Pixels = 50 as Pixels;
const y: Pixels = 10 as Pixels;
const diff = x - y;`,
      errors: [{ messageId: "leak" }],
    },
    // Multiplication — one branded operand
    {
      filename: TEST_FILENAME,
      code: `type Seconds = number & { readonly __brand: "Seconds" };
const a: Seconds = 10 as Seconds;
const b: Seconds = 20 as Seconds;
const product = a * b;`,
      errors: [{ messageId: "leak" }],
    },
    // Division of branded numbers
    {
      filename: TEST_FILENAME,
      code: `type Weight = number & { readonly __brand: "Weight" };
const a: Weight = 100 as Weight;
const b: Weight = 4 as Weight;
const half = a / b;`,
      errors: [{ messageId: "leak" }],
    },
    // Modulo on branded numbers
    {
      filename: TEST_FILENAME,
      code: `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 2500 as Milliseconds;
const b: Milliseconds = 1000 as Milliseconds;
const remainder = a % b;`,
      errors: [{ messageId: "leak" }],
    },
    // One branded operand, one plain number — still leaks the brand
    {
      filename: TEST_FILENAME,
      code: `type Seconds = number & { readonly __brand: "Seconds" };
const a: Seconds = 10 as Seconds;
const doubled = a * 2;`,
      errors: [{ messageId: "leak" }],
    },
    // Single underscore _brand variant
    {
      filename: TEST_FILENAME,
      code: `type Timeout = number & { readonly _brand: "Timeout" };
const a: Timeout = 500 as Timeout;
const b: Timeout = 100 as Timeout;
const result = a + b;`,
      errors: [{ messageId: "leak" }],
    },
    // PascalCase Brand suffix variant
    {
      filename: TEST_FILENAME,
      code: `type UserId = number & { readonly UserIdBrand: unique symbol };
const a: UserId = 1 as UserId;
const b: UserId = 2 as UserId;
const sum = a + b;`,
      errors: [{ messageId: "leak" }],
    },
  ],
});
