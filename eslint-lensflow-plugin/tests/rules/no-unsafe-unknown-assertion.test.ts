import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-unsafe-unknown-assertion.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

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

ruleTester.run("no-unsafe-unknown-assertion", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface AuthToken { token: string; expires: number }

function handleAuth(data: unknown): void {
  if (typeof data === "object" && data !== null && "token" in data) {
    const auth = data as AuthToken;
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isAuthToken(value: unknown): value is AuthToken {
  return typeof value === "object" && value !== null && "token" in value && "expires" in value;
}

function handleAuth(data: unknown): void {
  if (isAuthToken(data)) {
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isAuthToken(value: unknown): value is AuthToken {
  return value as AuthToken !== null;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `const isToken = (v: unknown): v is AuthToken => v as AuthToken !== null;`,
    },
    {
      filename: TEST_FILENAME,
      code: `function parse(data: string): string {
  return data as string;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function cast(data: unknown): unknown {
  return data as unknown;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function cast(data: unknown): never {
  return data as never;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function cast(data: unknown): any {
  return data as any;
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface AuthToken { token: string; expires: number }

function handleAuth(data: unknown): void {
  const auth = data as AuthToken;
}`,
      errors: [{ messageId: "unsafeCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `type User = { id: number; name: string }

function getUser(raw: unknown): User {
  return raw as User;
}`,
      errors: [{ messageId: "unsafeCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface AuthToken { token: string; expires: number }

function isToken(v: unknown): v is AuthToken {
  const fn = () => v as AuthToken;
  return fn() !== null;
}`,
      errors: [{ messageId: "unsafeCast" }],
    },
  ],
});
