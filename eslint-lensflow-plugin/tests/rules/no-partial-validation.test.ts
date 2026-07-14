import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-partial-validation.js";

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

ruleTester.run("no-partial-validation", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface User { email: string; name: string; age: number }
const UserSchema = { parse: (raw: unknown) => raw as User };
const user = UserSchema.parse(raw);`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { enabled: boolean }
declare const raw: Config;
if (typeof raw.enabled === "boolean") {
  /* process */
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Point { x: number; y: number }
declare const raw: Point;
if (typeof raw.x === "number" && typeof raw.y === "number") {
  /* process */
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `const x = 42;
if (x > 10) {
  console.log(x);
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface User { email: string; name: string }
declare const raw: User;
if ("email" in raw && "name" in raw) {
  /* process */
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface User { email: string; name: string }
declare const raw: User;
if ((function(raw: { email: string }) { return true; })() && typeof raw.email === "string" && typeof raw.name === "string") {
  /* all outer props checked; shadowed raw in IIFE is a separate binding */
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { host: string; port: number }
declare const config: Config;
if ((function(config: { host: string }) { return true; })() && typeof config.host === "string" && typeof config.port === "number") {
  /* all outer config props checked; nested function parameter shadows the outer name but is a separate binding */
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Item { id: string; value: number }
declare const raw: Item;
for (const i = 0; i < 10; i++) {
  if (typeof raw.id === "string" && typeof raw.value === "number") {
    /* all props checked inside for loop */
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Item { id: string; value: number }
declare const raw: Item;
try {
  if (typeof raw.id === "string" && typeof raw.value === "number") {
    /* all props checked inside try block */
  }
} catch (e) {}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Item { id: string; value: number }
declare const raw: Item;
if (true) {
  if (typeof raw.id === "string" && typeof raw.value === "number") {
    /* all props checked inside nested if */
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `interface Item { id: string; value: number }
declare const items: Item[];
if (items.every((item) => typeof item.id === "string")) {
  /* typeof check inside callback is not collected because walk() stops at function boundaries by default */
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface User { email: string; name: string; age: number }
declare const raw: User;
if (typeof raw.email === "string") {
  /* process */
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Payload { id: string; value: number; meta: string }
declare const raw: Payload;
if (typeof raw.id === "string" && typeof raw.value === "number") {
  /* process */
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Settings { theme: string; lang: string; fontSize: number }
declare const raw: Settings;
if ("theme" in raw) {
  /* process */
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Settings { theme: string; lang: string; fontSize: number }
declare const raw: Settings;
if (` + '`"theme"`' + ` in raw) {
  /* process */
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { host: string; port: number; timeout: number; retries: number }
declare const raw: Config;
if (typeof raw.host === "string" && typeof raw.port === "number") {
  /* process */
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { host: string; port: number; timeout: number }
declare const raw: Config;
for (const i = 0; i < 10; i++) {
  if (typeof raw.host === "string") {
    /* only one prop checked inside for loop */
  }
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { host: string; port: number; timeout: number }
declare const raw: Config;
try {
  if (typeof raw.port === "number") {
    /* only one prop checked inside try block */
  }
} catch (e) {}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Config { host: string; port: number; timeout: number }
declare const raw: Config;
if (true) {
  if (typeof raw.timeout === "number") {
    /* only one prop checked inside nested if */
  }
}`,
      errors: [{ messageId: "partialValidation" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface A { x: number; y: number }
interface B { p: string; q: string }
declare const a: A, b: B;
if (typeof a.x === "number" && typeof b.p === "string") {
  /* process */
}`,
      errors: [
        { messageId: "partialValidation" },
        { messageId: "partialValidation" },
      ],
    },
  ],
});
