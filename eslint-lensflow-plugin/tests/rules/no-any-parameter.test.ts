import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-parameter.js";

ruleTester.run("no-any-parameter", rule, {
  valid: [
    `function createUser(name: string, email: string) {
      return { name, email };
    }`,
    `const fn = (x: number): number => x * 2;`,
    `type Handler = (req: Request, res: Response) => void;`,
    `function process(data: unknown) {
      return data;
    }`,
    `const arrow = (items: string[]) => items.join(",");`,
    `function withDefault(x: string = "hello") { return x; }`,
    `function withNumberDefault(x: number = 0) { return x; }`,
    `const arrowDefault = (x: boolean = true) => x;`,
    `function withRest(...args: string[]) { return args; }`,
    `const arrowRest = (...nums: number[]) => nums.length;`,
    `function destructuredObj({ a, b }: { a: string; b: number }) { return a + b; }`,
    `function destructuredArr([first, second]: [string, number]) { return first + second; }`,
    `const arrowDestructured = ({ x }: { x: string }) => x;`,
  ],
  invalid: [
    {
      code: `function createUser(name: any, email: any) {
        return { name, email };
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyParam" }],
    },
    {
      code: `const bad = (value: any) => value.toString();`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `type BadHandler = (data: any) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const obj = { greet: function(msg: any) { return msg; } };`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `interface Service { handle(payload: any): void; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `declare function legacyApi(input: any): string;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `class App { constructor(public config: any) {} }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `interface Api { (data: any): void; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `type Api = (data: any) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function withDefault(x: any = 1) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const arrowDefault = (x: any = true) => x;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function withRest(...rest: any[]) { return rest; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const arrowRest = (...nums: any) => nums;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function destructuredObj({ a, b }: any) { return a + b; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function destructuredArr([first, second]: any) { return first; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const arrowDestructured = ({ x }: any) => x;`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function unionWithAny(x: any | string) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function arrayOfAny(items: any[]) { return items; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function intersectionWithAny(x: any & { foo: string }) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function genericWithAny(x: Array<any>) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
