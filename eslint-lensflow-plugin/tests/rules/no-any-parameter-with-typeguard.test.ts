import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-parameter-with-typeguard.js";

ruleTester.run("no-any-parameter-with-typeguard", rule, {
  valid: [
    `function f(x: string | number) {
      if (typeof x === "string") {
        console.log(x.toUpperCase());
      } else {
        console.log(x.toFixed(2));
      }
    }`,
    `const handler = (x: string) => {
      if (typeof x === "string") {
        return x.length;
      }
      return 0;
    };`,
    `function process(data: unknown) {
      if (typeof data === "string") {
        return data;
      }
    }`,
    `function identity(x: any) {
      return x;
    }`,
    `const fn = (a: number, b: string) => a + b.length;`,
  ],
  invalid: [
    {
      code: `function f(x: any) {
        if (typeof x === "string") {
          console.log(x.toUpperCase());
        }
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      code: `const handler = (data: any) => {
        if (data instanceof Date) {
          return data.toISOString();
        }
        return String(data);
      };`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      code: `function process(items: any, count: number) {
        if (typeof items === "string") {
          return items.split(",");
        }
        return items;
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      code: `function handle(obj: any) {
        if (typeof obj.foo === "undefined") {
          return null;
        }
        return obj;
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
  ],
});
