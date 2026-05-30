import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-utility-function.js";

ruleTester.run("no-any-in-utility-function", rule, {
  valid: [
    `function clone<T>(data: T): T {
      return JSON.parse(JSON.stringify(data));
    }`,
    `function greet(name: string): void {
      console.log(name);
    }`,
    `function process(data: unknown): boolean {
      return typeof data === "object";
    }`,
    `class Helper {
      method(data: any): any {
        return data;
      }
    }`,
    `const obj = {
      fn(data: any) { return data; }
    };`,
  ],
  invalid: [
    {
      code: `function clone(data: any): any {
        return JSON.parse(JSON.stringify(data));
      }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `export function stringify(value: any): any {
        return JSON.stringify(value);
      }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function parse(text: string): any {
        return JSON.parse(text);
      }`,
      errors: [{ messageId: "anyReturn" }],
    },
    {
      code: `export function deepMerge(a: any, b: any): any {
        return Object.assign({}, a, b);
      }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
  ],
});
