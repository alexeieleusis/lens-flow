import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-capability-check-t59.js";

ruleTester.run("no-as-any-capability-check-t59", rule, {
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
  ],
});
