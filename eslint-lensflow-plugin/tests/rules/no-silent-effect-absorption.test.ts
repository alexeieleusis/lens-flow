import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-silent-effect-absorption.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "tests/rules/test.ts";
const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
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

const EFFECT_TYPE_DEF = `
type Effect<A, E> = {
  _tag: "ok" | "err";
  map<A2>(fn: (a: A) => A2): Effect<A2, E>;
  chain<A2>(fn: (a: A) => Effect<A2, E>): Effect<A2, E>;
  match<B>(handlers: { ok: (a: A) => B; err: (e: E) => B }): B;
  mapErr<E2>(fn: (e: E) => E2): Effect<A, E2>;
  isOk(): boolean;
  isErr(): boolean;
  flatMap<A2>(fn: (a: A) => Effect<A2, E>): Effect<A2, E>;
  ap<A2>(f: Effect<(a: A) => A2>): Effect<A2, E>;
  unwrapOrElse<B>(fn: (e: E) => B): B;
};
`;

ruleTester.run("no-silent-effect-absorption", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.match({ ok: (x) => console.log(x), err: (e) => console.error(e) });`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.map((x) => x.length).match({ ok: (n) => n * 2, err: (e) => -1 });`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.mapErr((e) => new Error(e.message));`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.unwrapOrElse((e) => "default");`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.flatMap((x) => r).match({ ok: (x) => console.log(x), err: (e) => console.error(e) });`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
declare const f: Effect<(x: string) => number>;
r.ap(f).match({ ok: (n) => n * 2, err: (e) => -1 });`,
    },
    {
      filename: TEST_FILENAME,
      code: `const arr = [1, 2, 3];
arr.map((x) => x * 2);`,
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.customHandle();`,
      options: [{ allowedTerminators: ["customHandle"] }],
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.map((x) => x.length);`,
      errors: [{ messageId: "silentAbsorption" }],
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<{ name: string }, Error>;
r.chain((user) => r);`,
      errors: [{ messageId: "silentAbsorption" }],
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.map((x) => x).map((y) => y.toUpperCase());`,
      errors: [{ messageId: "silentAbsorption" }],
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `declare const r: Effect<string, Error> | undefined;
r?.map((x) => x.length);`,
      errors: [{ messageId: "silentAbsorption" }],
    },
    {
      filename: TEST_FILENAME,
      code: EFFECT_TYPE_DEF + `
declare const r: Effect<string, Error>;
r.map((x) => x.length);`,
      options: [{ allowedTerminators: [] }],
      errors: [{ messageId: "silentAbsorption" }],
    },
  ],
});
