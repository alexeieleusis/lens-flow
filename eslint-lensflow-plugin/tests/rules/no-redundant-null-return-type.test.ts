import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-redundant-null-return-type.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

ruleTester.run("no-redundant-null-return-type", rule, {
  valid: [
    // Function that genuinely can return null
    {
      filename: TEST_FILENAME,
      code: `interface User { name: string | null; }
function getUserName(user: User): string | null {
  return user.name;
}`,
    },
    // Function with conditional null return
    {
      filename: TEST_FILENAME,
      code: `function findItem(items: string[], key: string): string | null {
  const idx = items.indexOf(key);
  if (idx === -1) return null;
  return items[idx];
}`,
    },
    // Return type is not nullable
    {
      filename: TEST_FILENAME,
      code: `function getUserName(): string {
  return "hello";
}`,
    },
    // Function that returns undefined legitimately
    {
      filename: TEST_FILENAME,
      code: `function lookup(map: Map<string, number>, key: string): number | undefined {
  return map.get(key);
}`,
    },
  ],
  invalid: [
    // Antipattern from spec: ?? null on a non-nullable value
    {
      filename: TEST_FILENAME,
      code: `interface User { name: string; }
function getUserName(user: User): string | null {
  return user.name ?? null;
}`,
      errors: [{ messageId: "redundantNullReturnType" }],
    },
    // Arrow function returning string literal but annotated with | null
    {
      filename: TEST_FILENAME,
      code: `const getStatus = (code: number): string | null => {
  return code === 200 ? "ok" : "error";
};`,
      errors: [{ messageId: "redundantNullReturnType" }],
    },
    // Multiple returns, none produce null/undefined
    {
      filename: TEST_FILENAME,
      code: `function classify(n: number): string | null {
  if (n < 0) return "negative";
  if (n === 0) return "zero";
  return "positive";
}`,
      errors: [{ messageId: "redundantNullReturnType" }],
    },
    // Return type includes undefined but no return can be undefined
    {
      filename: TEST_FILENAME,
      code: `function getLabel(id: number): string | undefined {
  return \`item-\${id}\`;
}`,
      errors: [{ messageId: "redundantNullReturnType" }],
    },
  ],
});
