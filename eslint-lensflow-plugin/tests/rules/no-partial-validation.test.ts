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
  ],
});
