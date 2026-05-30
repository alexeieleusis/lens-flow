import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-callable.js";

ruleTester.run("no-any-in-callable", rule, {
  valid: [
    `function wrap<T>(x: T): { value: T } { return { value: x }; }`,
    `function wrap(x: string): { value: string } { return { value: x }; }`,
    `const fn = <T>(x: T): T => x;`,
    `type Handler = (req: Request, res: Response) => void;`,
    `const cb = (x: number): number => x * 2;`,
    `declare function external(x: any): any;`,
    `function safe(x: unknown): unknown { return x; }`,
  ],
  invalid: [
    {
      code: `function wrap(x: any): any { return { value: x }; }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function process(data: any) { console.log(data); }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const fn = (x: any): any => x;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `type Wrap = (x: any) => any;`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyReturn" },
      ],
    },
    {
      code: `function identity(x: any) { return x; }`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
