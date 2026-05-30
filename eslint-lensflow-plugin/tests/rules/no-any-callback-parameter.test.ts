import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-callback-parameter.js";

ruleTester.run("no-any-callback-parameter", rule, {
  valid: [
    `function forEach<T>(items: T[], cb: (item: T) => void) {
      items.forEach(cb);
    }`,
    `function process(items: string[], cb: (item: string) => void) {
      items.forEach(cb);
    }`,
    `type SafeCallback = (item: unknown) => void;`,
    `interface Processor {
      handle(item: number): void;
    }`,
    `declare function transform(cb: (value: string) => string): void;`,
  ],
  invalid: [
    {
      code: `function forEach(items: any[], cb: (item: any) => void) {
        items.forEach(cb);
      }`,
      errors: [{ messageId: "anyCallbackParameter" }],
    },
    {
      code: `interface Callback {
        execute(data: any): void;
      }`,
      errors: [{ messageId: "anyCallbackParameter" }],
    },
    {
      code: `type UnsafeCallback = (item: any) => void;`,
      errors: [{ messageId: "anyCallbackParameter" }],
    },
    {
      code: `declare function register(handler: (event: any) => void): void;`,
      errors: [{ messageId: "anyCallbackParameter" }],
    },
    {
      code: `function forEach(items: any[], cb: (item: any) => void) {
        items.forEach(cb);
      }
      forEach([1, 2, 3], (item) => {
        item.toUpperCase();
      });`,
      errors: [{ messageId: "anyCallbackParameter" }],
    },
  ],
});
