import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-direct-brand-cast.js";

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

ruleTester.run("no-direct-brand-cast", rule, {
  valid: [
    // Smart constructor function — cast inside parseXxx is allowed
    {
      filename: TEST_FILENAME,
      code: `type Email = string & { readonly __brand: "Email" };

function parseEmail(raw: string): Email {
  if (!raw.includes("@")) throw new Error("Invalid email");
  return raw as Email;
}`,
    },
    // Arrow function smart constructor
    {
      filename: TEST_FILENAME,
      code: `type UserId = string & { readonly __brand: "UserId" };

const parseUserId = (raw: string): UserId => {
  if (!raw) throw new Error("Empty id");
  return raw as UserId;
};`,
    },
    // Named FunctionExpression smart constructor
    {
      filename: TEST_FILENAME,
      code: `type PhoneNumber = string & { readonly __brand: "PhoneNumber" };

const parsePhoneNumber = function parsePhoneNumber(raw: string): PhoneNumber {
  if (!/^\+?[1-9]\d{1,14}$/.test(raw)) throw new Error("Invalid phone");
  return raw as PhoneNumber;
};`,
    },
    // Non-branded type cast — plain string to string
    {
      filename: TEST_FILENAME,
      code: `const s = "hello" as string;`,
    },
    // Casting already branded value to same branded type
    {
      filename: TEST_FILENAME,
      code: `type Email = string & { readonly __brand: "Email" };

function parseEmail(raw: string): Email {
  return raw as Email;
}

const e2: Email = parseEmail("a@b.com") as Email;`,
    },
    // tryParse smart constructor
    {
      filename: TEST_FILENAME,
      code: `type Url = string & { readonly __brand: "Url" };

function tryParseUrl(raw: string): Url | null {
  try {
    new URL(raw);
    return raw as Url;
  } catch {
    return null;
  }
}`,
    },
    // mustParse smart constructor
    {
      filename: TEST_FILENAME,
      code: `type PositiveInt = number & { readonly __brand: "PositiveInt" };

function mustParsePositiveInt(raw: number): PositiveInt {
  if (raw <= 0) throw new Error("Must be positive");
  return raw as PositiveInt;
}`,
    },
  ],
  invalid: [
    // Direct cast of raw string to branded Email type
    {
      filename: TEST_FILENAME,
      code: `type Email = string & { readonly __brand: "Email" };

const email: Email = "plain string" as Email;`,
      errors: [{ messageId: "directBrandCast" }],
    },
    // Direct cast of raw number to branded UserId type
    {
      filename: TEST_FILENAME,
      code: `type UserId = number & { readonly __brand: "UserId" };

const id: UserId = 42 as UserId;`,
      errors: [{ messageId: "directBrandCast" }],
    },
    // Cast inside a function that does not match smart constructor pattern
    {
      filename: TEST_FILENAME,
      code: `type Token = string & { readonly __brand: "Token" };

function makeToken(raw: string): Token {
  return raw as Token;
}`,
      errors: [{ messageId: "directBrandCast" }],
    },
    // Multiple direct casts in same scope
    {
      filename: TEST_FILENAME,
      code: `type Email = string & { readonly __brand: "Email" };
type Domain = string & { readonly __brand: "Domain" };

const e: Email = "a@b.com" as Email;
const d: Domain = "b.com" as Domain;`,
      errors: [
        { messageId: "directBrandCast" },
        { messageId: "directBrandCast" },
      ],
    },
    // String literal cast to branded type (still a raw primitive)
    {
      filename: TEST_FILENAME,
      code: `type Status = string & { readonly __brand: "Status" };

const s: Status = "active" as Status;`,
      errors: [{ messageId: "directBrandCast" }],
    },
    // Cast inside nested callback within smart constructor — must still be flagged
    {
      filename: TEST_FILENAME,
      code: `type Email = string & { readonly __brand: "Email" };

function parseEmail(raw: string): Email {
  const handler = () => "x" as Email;
  if (!raw.includes("@")) throw new Error("Invalid email");
  return raw as Email;
}`,
      errors: [{ messageId: "directBrandCast" }],
    },
  ],
});
