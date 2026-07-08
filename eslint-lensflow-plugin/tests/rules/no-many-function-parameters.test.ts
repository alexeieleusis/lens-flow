import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-many-function-parameters.js";

ruleTester.run("no-many-function-parameters", rule, {
  valid: [
    `function createServer(host: string, port: number, timeout: number, keepAlive: boolean) { /* ... */ }`,
    `function createServer(config: { host: string; port: number; timeout: number; keepAlive: boolean; maxConnections: number }) { /* ... */ }`,
    `const fn = (...args: string[]) => args.join("");`,
    `function fn(a: string, b: number, c: boolean, d: string, ...rest: string[]) { }`,
    `const fn = function handler(a: string, b: number, c: boolean, d: string) { }`,
    `class Foo { constructor(public a: string, public b: number, public c: boolean, public d: string, public e: symbol) { } }`,
  ],
  invalid: [
    {
      code: `function createServer(
  host: string,
  port: number,
  timeout: number,
  keepAlive: boolean,
  maxConnections: number
) { /* ... */ }`,
      errors: [{ messageId: "tooManyParams" }],
    },
    {
      code: `const handler = (a: string, b: number, c: boolean, d: string, e: symbol) => { };`,
      errors: [{ messageId: "tooManyParams" }],
    },
    {
      code: `function fn(a: string, b: number, c: boolean, d: string, e: symbol, ...rest: string[]) { }`,
      errors: [{ messageId: "tooManyParams" }],
    },
    {
      code: `const fn = function handler(a: string, b: number, c: boolean, d: string, e: symbol) { }`,
      errors: [{ messageId: "tooManyParams" }],
    },
  ],
});
