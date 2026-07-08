import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import path from "path";
import rule from "../../src/rules/no-as-any-capability-check-t59.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const typeAwareTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: path.join(__dirname, "../tsconfig.json"),
      tsconfigRootDir: path.join(__dirname, ".."),
    },
  },
});

typeAwareTester.run("no-as-any-capability-check-t59", rule, {
  valid: [
    `interface Handler {
      onEvent(e: Event): void;
    }

    function registerHandle(h: Handler) {
      h.onEvent({});
    }`,
    `type Handler = { onEvent(e: Event): void } | { api: string };

    function callHandler(h: Handler) {
      if ("onEvent" in h) h.onEvent({});
    }`,
    `const x = someValue as string;`,
    `function foo(x: unknown) {
      const s = x as string;
      return s.length;
    }`,
    `function foo(x: { a: string; b: number }) {
      if ((x as any).c) console.log(x.c);
    }`,
    `function f(x: { foo: string }) {
      if ((x as any).foo) {}
    }`,
  ],
  invalid: [
    {
      code: `type Handler = { onEvent(e: Event): void } | { api: string };

      function registerHandle(h: Handler) {
        if ((h as any).onEvent) h.onEvent({});
      }`,
      errors: [{ messageId: "capabilityProbe" }],
    },
    {
      code: `type Obj = { foo: string } | { bar: number };

      function check(o: Obj) {
        if ((o as any).foo) console.log(o.foo);
      }`,
      errors: [{ messageId: "capabilityProbe" }],
    },
    {
      code: `type A = { method(): void } | { other: string };

      function use(x: A) {
        const result = (x as any).method || fallback;
      }`,
      errors: [{ messageId: "capabilityProbe" }],
    },
    {
      code: `type X = { foo: string } | { bar: number };

      function test(x: X) {
        if ((x as any)?.foo) console.log(x.foo);
      }`,
      errors: [{ messageId: "capabilityProbe" }],
    },
    {
      code: `type X = { foo: string } | { bar: number };

      function test(x: X) {
        if ((x as any)!.foo) console.log(x.foo);
      }`,
      errors: [{ messageId: "capabilityProbe" }],
    },
  ],
});
