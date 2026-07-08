import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-collect-then-transform.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tests", "tsconfig.json");

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
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function transformReassigned(source: AsyncIterable<number>): Promise<number[]> {
  let arr = await collect(source);
  arr = [1, 2, 3];
  return arr.map(n => n * 2);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function getString(): string {
  return "hello world";
}

function processString() {
  const s = getString();
  return s.split("").map(c => c.toUpperCase()).join("");
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
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function inlineTransform(source: AsyncIterable<number>): Promise<number[]> {
  return (await collect(source)).map(n => n * 2);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function typedInlineTransform(source: AsyncIterable<number>): Promise<number[]> {
  return (await collect(source) as number[]).filter(n => n > 0);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function sortCollected(source: AsyncIterable<number>): Promise<number[]> {
  const arr = await collect(source);
  return arr.sort((a, b) => a - b);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function findInCollected(source: AsyncIterable<number>): Promise<number | undefined> {
  const arr = await collect(source);
  return arr.find(n => n > 100);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
    {
      filename: TEST_FILENAME,
      code: `async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = [];
  for await (const item of source) {
    arr.push(item);
  }
  return arr;
}

async function toSortedCollected(source: AsyncIterable<number>): Promise<number[]> {
  const arr = await collect(source);
  return arr.toSorted((a, b) => a - b);
}`,
      errors: [{ messageId: "collectThenTransform" }],
    },
  ],
});
