import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-collect-then-sync-iterate.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = resolve(__dirname, "../..");
const TS_CONFIG = join(TS_CONFIG_DIR, "tests", "tsconfig.json");

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

ruleTester.run("no-collect-then-sync-iterate", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `async function process(source: AsyncIterable<string>): Promise<void> {
  for await (const item of source) {
    await process(item);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function syncIterate(items: string[]) {
  for (const item of items) {
    console.log(item);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function process(source: AsyncIterable<string>): Promise<void> {
  const all: string[] = [];
  for await (const item of source) {
    all.push(item);
  }
  for (const item of all) {
    console.log(item);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `async function summarize(source: AsyncIterable<string>): Promise<string> {
  let result = "";
  for await (const item of source) {
    result += item;
  }
  return result;
}

async function process(source: AsyncIterable<string>): Promise<void> {
  const text = await summarize(source);
  for (const char of text) {
    console.log(char);
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

async function processBad(source: AsyncIterable<string>): Promise<void> {
  const all = await collect(source);
  for (const item of all) {
    console.log(item);
  }
}`,
      errors: [{ messageId: "collectThenSyncIterate" }],
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

async function handleEvents(events: AsyncIterable<{ type: string }>): Promise<void> {
  const collected = await toArray(events);
  for (const event of collected) {
    console.log(event.type);
  }
}`,
      errors: [{ messageId: "collectThenSyncIterate" }],
    },
  ],
});
