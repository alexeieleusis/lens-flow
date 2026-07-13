import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-mutable-items-in-readonly-collection.js";

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

ruleTester.run("no-mutable-items-in-readonly-collection", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface ImmutableCounter {
        readonly value: number;
      }
      type State = {
        readonly counters: ReadonlyArray<ImmutableCounter>;
      };`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Point {
        readonly x: number;
        readonly y: number;
      }
      interface Container {
        readonly items: ReadonlyArray<Point>;
      }`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface ImmutableData {
        readonly name: string;
      }
      type Config = {
        readonly data: Readonly<ImmutableData>;
      };`,
    },
    {
      filename: TEST_FILENAME,
      code: `class ImmutableEntity {
        readonly name: string;
        constructor(name: string) { this.name = name; }
      }
      interface Container {
        readonly items: ReadonlyArray<ImmutableEntity>;
      };`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface MutableCounter {
        value: number;
        increment(): void;
      }
      interface State {
        readonly counters: ReadonlyArray<MutableCounter>;
      }`,
      errors: [{ messageId: "mutableInnerType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface MutableItem {
        id: number;
        name: string;
        update(name: string): void;
      }
      type Container = {
        readonly items: ReadonlyArray<MutableItem>;
      };`,
      errors: [{ messageId: "mutableInnerType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface MutableConfig {
        setting: string;
      }
      type App = {
        readonly config: Readonly<MutableConfig>;
      };`,
      errors: [{ messageId: "mutableInnerType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `class MutableEntity {
        name: string;
        constructor(name: string) { this.name = name; }
        update(n: string): void { this.name = n; }
      }
      interface Container {
        readonly items: ReadonlyArray<MutableEntity>;
      }`,
      errors: [{ messageId: "mutableInnerType" }],
    },
  ],
});
