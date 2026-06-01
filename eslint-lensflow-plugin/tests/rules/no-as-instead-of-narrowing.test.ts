import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-as-instead-of-narrowing.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TS_CONFIG_PATH = path.resolve(__dirname, "../../tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG_PATH,
      tsconfigRootDir: path.dirname(TS_CONFIG_PATH),
    },
  },
});

const filename = "tests/rules/test.ts";

ruleTester.run("no-as-instead-of-narrowing", rule, {
  valid: [
    {
      filename,
      code: `function handle(x: string | number) {
  if (typeof x === "string") {
    x.toUpperCase();
  }
}`,
    },
    {
      filename,
      code: `const x = "hello" as const;`,
    },
    {
      filename,
      code: `function identity(s: string): string {
  return s as string;
}`,
    },
    {
      filename,
      code: `function handle(x: string | number) {
  const result = x as unknown as string;
}`,
    },
  ],
  invalid: [
    {
      filename,
      code: `function handle(x: string | number) {
  const s = x as string;
  s.toUpperCase();
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
    {
      filename,
      code: `function handle(x: string | number) {
  const n = x as number;
  n.toFixed();
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
  ],
});
