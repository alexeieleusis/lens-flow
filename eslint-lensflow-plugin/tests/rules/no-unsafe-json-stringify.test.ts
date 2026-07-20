import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-unsafe-json-stringify.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = resolve(__dirname, "../..");
const TS_CONFIG = join(TS_CONFIG_DIR, "tsconfig.test.json");

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

ruleTester.run("no-unsafe-json-stringify", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface WireOrder {
        createdAt: string;
        amount: number;
      }
      const order: WireOrder = { createdAt: "2024-01-01", amount: 100 };
      JSON.stringify(order);`,
    },
    {
      filename: TEST_FILENAME,
      code: `type Serialized<T> = {
        [K in keyof T]: T[K] extends Date ? string : T[K];
      };
      interface Order {
        createdAt: Date;
        amount: number;
      }
      type WireOrder = Serialized<Order>;
      function toWire(o: Order): WireOrder {
        return { ...o, createdAt: o.createdAt.toISOString() } as WireOrder;
      }
      const order: Order = { createdAt: new Date(), amount: 100 };
      JSON.stringify(toWire(order));`,
    },
    {
      filename: TEST_FILENAME,
      code: `const data = { name: "test", count: 42 };
      JSON.stringify(data);`,
    },
    {
      filename: TEST_FILENAME,
      code: `JSON.stringify("hello");`,
    },
    {
      filename: TEST_FILENAME,
      code: `JSON.stringify([1, 2, 3]);`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface Order {
        createdAt: Date;
        amount: number;
      }
      const order: Order = { createdAt: new Date(), amount: 100 };
      JSON.stringify(order);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config {
        tags: Set<string>;
        count: number;
      }
      const config: Config = { tags: new Set(["a", "b"]), count: 5 };
      JSON.stringify(config);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Metadata {
        id: string;
        data: Map<string, number>;
      }
      const meta: Metadata = { id: "1", data: new Map() };
      JSON.stringify(meta);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Event {
        timestamp: Date;
        payload: { value: bigint };
      }
      const event: Event = { timestamp: new Date(), payload: { value: 1n } };
      JSON.stringify(event);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Handler {
        callback: () => void;
        count: number;
      }
      const h: Handler = { callback: () => {}, count: 0 };
      JSON.stringify(h);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Store {
        cache: WeakMap<object, string>;
        key: string;
      }
      const store: Store = { cache: new WeakMap(), key: "x" };
      JSON.stringify(store);`,
      errors: [{ messageId: "unsafeType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface AsyncData {
        promise: Promise<string>;
        id: number;
      }
      const data: AsyncData = { promise: Promise.resolve("ok"), id: 1 };
      JSON.stringify(data);`,
      errors: [{ messageId: "unsafeType" }],
    },
  ],
});
