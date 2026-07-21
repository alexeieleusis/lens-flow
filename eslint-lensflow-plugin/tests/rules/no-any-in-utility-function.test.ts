import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-utility-function.js";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T04-generics-bounds.md");

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
    `const handler = {
      onClick: (e: any) => console.log(e),
    };`,
    `export const handler = {
      onClick: (e: any) => console.log(e),
    };`,
    `class Foo {
      bar = (data: any) => data;
    }`,
    // Nested function inside another function body — NOT standalone
    `function outer() {
      function inner(data: any): any { return data; }
    }`,
    // Nested arrow function inside another function body — NOT standalone
    `function outer() {
      const inner = (data: any): any => data;
    }`,
  ],
  invalid: [
    {
      code: `function clone(data: any): any {
        return JSON.parse(JSON.stringify(data));
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `export function stringify(value: any): any {
        return JSON.stringify(value);
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
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
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function process(...rest: any): void {
        rest.forEach(console.log);
      }`,
      errors: [{ messageId: "anyParam", data: { name: "rest", url: URL } }],
    },
    {
      code: `function handle({ a }: any): void {
        console.log(a);
      }`,
      errors: [
        { messageId: "anyParam", data: { name: "{ a }: any", url: URL } },
      ],
    },
    {
      code: `function process([x]: any): void {
        console.log(x);
      }`,
      errors: [{ messageId: "anyParam", data: { name: "[x]: any", url: URL } }],
    },
    {
      code: `export const clone = (data: any): any => JSON.parse(JSON.stringify(data))`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `const clone = (data: any): any => JSON.parse(JSON.stringify(data))`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `export const stringify = function(value: any): any {
        return JSON.stringify(value);
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `const stringify = function(value: any): any {
        return JSON.stringify(value);
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `export default function clone(data: any): any {
        return JSON.parse(JSON.stringify(data));
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `export default (data: any) => data`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `export default function parse(text: string): any {
        return JSON.parse(text);
      }`,
      errors: [{ messageId: "anyReturn" }],
    },
    {
      code: `export const handle = ({ a = 1 }: any): void => {
        console.log(a);
      }`,
      errors: [
        { messageId: "anyParam", data: { name: "{ a = 1 }: any", url: URL } },
      ],
    },
    {
      code: `export const process = ([x = 0]: any): void => {
        console.log(x);
      }`,
      errors: [
        { messageId: "anyParam", data: { name: "[x = 0]: any", url: URL } },
      ],
    },
    {
      code: `function process<T>(data: any, config: T): any {
        return config;
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
    {
      code: `export const map = <T>(items: any): T => items as T`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
