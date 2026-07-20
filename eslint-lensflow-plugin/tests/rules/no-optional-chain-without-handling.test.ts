import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-optional-chain-without-handling.js";

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

ruleTester.run("no-optional-chain-without-handling", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `
interface Config { db?: { host: string } }
declare const config: Config;
const host = config.db?.host ?? "localhost";
`,
    },
    {
      filename: TEST_FILENAME,
      code: `
interface Config { db?: { port: number } }
declare const config: Config;
const port = config.db?.port ?? 3000;
`,
    },
    {
      filename: TEST_FILENAME,
      code: `
interface Obj { a?: { b?: { c: string } } }
declare const obj: Obj;
const value = obj.a?.b?.c ?? "default";
`,
    },
    {
      filename: TEST_FILENAME,
      code: `
interface Maybe { value?: string }
declare const x: Maybe;
const v = x.value;
`,
    },
    {
      filename: TEST_FILENAME,
      code: `
declare const arr: string[] | undefined;
const len = arr?.length ?? 0;
`,
    },
    {
      // When TS type checker determines the optional chain's result does NOT
      // include undefined (e.g. via type assertion), no error should be reported.
      filename: TEST_FILENAME,
      code: `
interface Config { db?: { host: string } }
declare const config: Config;
const host = config.db?.host as string;
`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `
interface Config { db?: { host: string } }
declare const config: Config;
const host = config.db?.host;
host.toUpperCase();
`,
      errors: [{ messageId: "undefinedType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
interface User { profile?: { name: string } }
declare const user: User;
const name = user.profile?.name;
console.log(name);
`,
      errors: [{ messageId: "undefinedType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
interface Response { data?: { items?: string[] } }
declare const response: Response;
const items = response.data?.items;
items.forEach((item) => console.log(item));
`,
      errors: [{ messageId: "undefinedType" }],
    },
    {
      filename: TEST_FILENAME,
      code: `
interface Data { results?: { count: number } }
declare const data: Data;
const count = data.results?.count;
const incremented = count + 1;
`,
      errors: [{ messageId: "undefinedType" }],
    },
  ],
});
