import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-as-instead-of-narrowing.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const TS_CONFIG_DIR = resolve(__dirname, "../..");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: join(TS_CONFIG_DIR, "tsconfig.test.json"),
      tsconfigRootDir: TS_CONFIG_DIR,
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
    {
      filename,
      code: `function handle(x: string | null) {
  if (x !== null) {
    x.toUpperCase();
  }
}`,
    },
    {
      filename,
      code: `function handle(x: string | undefined) {
  if (typeof x !== "undefined") {
    x.toUpperCase();
  }
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
    {
      filename,
      code: `function handle(x: string | null) {
  const s = x as string;
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
    {
      filename,
      code: `function handle(x: string | undefined) {
  const s = x as string;
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
    {
      filename,
      code: `function f(x: "a" | "b") {
  const a = x as "a";
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
    {
      filename,
      code: `function f(x: 1 | 2) {
  const n = x as 1;
}`,
      errors: [{ messageId: "narrowViaAs" }],
    },
  ],
});
