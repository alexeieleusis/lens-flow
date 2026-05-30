import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-collect-then-transform.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "file.ts";
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

ruleTester.run("no-collect-then-transform", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `async function* transformStream(source: AsyncIterable<number>): AsyncGenerator<number> {
  for await (const n of source) {
    yield n * 2;
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function syncTransform(items: number[]) {
  return items.map(n => n * 2);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function process(source: AsyncIterable<number>): Promise<void> {
  for await (const n of source) {
    console.log(n * 2);
  }
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function transformBad(source: AsyncIterable<number>): Promise<number[]> {
  const arr = await collect(source);
  return arr.map(n => n * 2);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function toArray<T>(source: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of source) {
    result.push(item);
  }
  return result;
}

async function filterEvents(events: AsyncIterable<{ type: string }>): Promise<{ type: string }[]> {
  const collected = await toArray(events);
  return collected.filter(e => e.type === "click");
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
  ],
});
