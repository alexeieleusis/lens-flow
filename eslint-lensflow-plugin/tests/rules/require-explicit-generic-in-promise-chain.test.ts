import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-explicit-generic-in-promise-chain.js";

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

ruleTester.run("require-explicit-generic-in-promise-chain", rule, {
  valid: [
    // Explicit type argument on the generic call — callback is properly typed
    {
      filename: TEST_FILENAME,
      code: `interface User { id: number; name: string; }
function fetch<T>(): Promise<T> {
  return {} as T;
}

fetch<User>().then((data) => {
  return data.id;
});`,
    },
    // Callback parameter has explicit type annotation
    {
      filename: TEST_FILENAME,
      code: `interface User { id: number; name: string; }
function fetch<T>(): Promise<T> {
  return {} as T;
}

fetch().then((data: User) => {
  return data.id;
});`,
    },
    // Non-generic function returning Promise — rule does not apply
    {
      filename: TEST_FILENAME,
      code: `function fetchConfig(): Promise<{ host: string }> {
  return Promise.resolve({ host: "localhost" });
}

fetchConfig().then((cfg) => {
  return cfg.host;
});`,
    },
    // Generic function but return type is not Promise
    {
      filename: TEST_FILENAME,
      code: `function identity<T>(value: T): T {
  return value;
}

const result = identity(42);`,
    },
    // .then() callback is not a function expression (e.g. a reference)
    {
      filename: TEST_FILENAME,
      code: `function fetch<T>(): Promise<T> {
  return {} as T;
}

const handler = (x: unknown) => x;
fetch().then(handler);`,
    },
    // Generic call where types ARE inferrable from arguments — no issue
    {
      filename: TEST_FILENAME,
      code: `function mapAsync<T, U>(fn: (t: T) => U, item: T): Promise<U> {
  return Promise.resolve(fn(item));
}

mapAsync((x: string) => x.length, "hello").then((len) => {
  console.log(len);
});`,
    },
  ],
  invalid: [
    // Generic Promise function called without type arg, callback param is `unknown`
    {
      filename: TEST_FILENAME,
      code: `interface User { id: number; name: string; }
function fetch<T>(): Promise<T> {
  return {} as T;
}

fetch().then((data) => {
  return data.id;
});`,
      errors: [{ messageId: "missingTypeArg" }],
    },
    // Generic function returning Promise, no type arg, callback is `unknown`
    {
      filename: TEST_FILENAME,
      code: `function request<T>(): Promise<T> {
  return Promise.resolve({} as T);
}

request().then((response) => {
  console.log(response);
});`,
      errors: [{ messageId: "missingTypeArg" }],
    },
    // Generic async function with no inferrable args
    {
      filename: TEST_FILENAME,
      code: `async function load<T>(): Promise<T> {
  return fetch("/api").then((r) => r.json()) as Promise<T>;
}

load().then((result) => {
  return result;
});`,
      errors: [{ messageId: "missingTypeArg" }],
    },
  ],
});
