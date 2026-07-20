import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-this-method-reference-assignment.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = dirname(fileURLToPath(import.meta.url));
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

ruleTester.run("no-this-method-reference-assignment", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `class Builder {
        setFlag(value: string): Builder {
          return this;
        }
      }
      const b = new Builder();
      b.setFlag("x");`,
    },
    {
      filename: TEST_FILENAME,
      code: `class Builder {
        getName(): string {
          return "builder";
        }
      }
      const b = new Builder();
      const fn = b.getName;`,
    },
    {
      filename: TEST_FILENAME,
      code: `const fn = Math.random;`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `class BaseBuilder {
        setFlag(value: string): this {
          return this;
        }
      }
      class ExtendedBuilder extends BaseBuilder {
        extended(): this {
          return this;
        }
      }
      const b = new ExtendedBuilder();
      const fn = b.setFlag;`,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `class FluentApi {
        chain(): this {
          return this;
        }
      }
      const instance = new FluentApi();
      let ref = instance.chain;`,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
        const Builder = class {
          setFlag(v: string): this { return this; }
        };
        const b = new Builder();
        const fn = b.setFlag;
      `,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
        abstract class Base {
          abstract build(): this;
        }
        class Derived extends Base {
          build(): this { return this; }
        }
        const b = new Derived();
        const fn = b.build;
      `,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
        class C { m(): this | undefined { return this; } }
        const c = new C();
        const fn = c.m;
      `,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
        interface Extra { extra(): void; }
        class C { m(): this & Extra { return this as any; } }
        const c = new C();
        const fn = c.m;
      `,
      errors: [{ messageId: "methodRefAssignment" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
        class C { m(): this { return this; } }
        const c = new C();
        let fn;
        fn = c.m;
      `,
      errors: [{ messageId: "methodRefAssignment" }],
    },
  ],
});
