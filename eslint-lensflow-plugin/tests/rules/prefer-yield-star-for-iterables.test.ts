import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/prefer-yield-star-for-iterables.js";

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

ruleTester.run("prefer-yield-star-for-iterables", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `async function* goodGenerator(): AsyncGenerator<string, void> {
  const items = ["a", "b", "c"];
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* singleElement(): AsyncGenerator<string, void> {
  yield "hello";
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function notGenerator(items: string[]): Promise<void> {
  const arr = items;
  console.log(arr);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function* syncGenerator(): Generator<string, void> {
  const items = ["a", "b"];
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* numbered(): AsyncGenerator<number, void> {
  const count = 42;
  yield count;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* yieldIterable(): AsyncGenerator<string, void> {
  const items: Iterable<string> = ["a", "b", "c"];
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* yieldAsyncIterable(): AsyncGenerator<string, void> {
  const items: AsyncIterable<string> = (async function*() { yield "a"; })();
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* gen(): AsyncGenerator<string, void> {
  const handler = () => { yield ["a"]; };
  yield* ["b"];
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* yieldSet(): AsyncGenerator<string, void> {
  const items = new Set(["a", "b", "c"]);
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* yieldMap(): AsyncGenerator<string, void> {
  const items = new Map([["key", "value"]]);
  yield* items;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function* yieldCustomIterable(): AsyncGenerator<string, void> {
  const items: Iterable<string> = {
    *[Symbol.iterator]() {
      yield "a";
      yield "b";
    },
  };
  yield* items;
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `async function* badGenerator(): AsyncGenerator<string, void> {
  const page1 = { items: ["a", "b", "c"] };
  const page2 = { items: ["d", "e", "f"] };
  yield page1.items;
  yield page2.items;
}`,
      errors: [
        { messageId: "preferYieldStar" },
        { messageId: "preferYieldStar" },
      ],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* allPages(): AsyncGenerator<string, void> {
  const items: string[] = [];
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* iterables(): AsyncGenerator<string, void> {
  const values: string[] = ["x", "y", "z"];
  yield values;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* badIterable(): AsyncGenerator<string, void> {
  const items: Iterable<string> = ["a", "b", "c"];
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* badAsyncIterable(): AsyncGenerator<string, void> {
  const items: AsyncIterable<string> = (async function*() { yield "a"; })();
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* badSet(): AsyncGenerator<string, void> {
  const items = new Set(["a", "b", "c"]);
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* badMap(): AsyncGenerator<string, void> {
  const items = new Map([["key", "value"]]);
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function* badCustomIterable(): AsyncGenerator<string, void> {
  const items: Iterable<string> = {
    *[Symbol.iterator]() {
      yield "a";
      yield "b";
    },
  };
  yield items;
}`,
      errors: [{ messageId: "preferYieldStar" }],
    },
  ],
});
