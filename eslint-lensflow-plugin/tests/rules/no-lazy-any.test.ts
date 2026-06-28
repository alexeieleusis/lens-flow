import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-lazy-any.js";

ruleTester.run("no-lazy-any", rule, {
  valid: [
    // Not all params are any
    `function process(x: any, y: string): any {
      return x + y;
    }`,
    // All params are any but return type is not any
    `function process(x: any, y: any): string {
      return String(x);
    }`,
    // Return is any but params are properly typed
    `function process(x: string, y: number): any {
      return x;
    }`,
    // No parameters
    `function getData(): any {
      return {};
    }`,
    // Arrow function with typed params
    `const fn = (x: string): any => x;`,
    // Properly typed function
    `interface Input { value: number; extra: number }
function processData(x: Input): number {
  return x.value + x.extra;
}`,
    // Rest parameter properly typed, return any
    `function sum(...args: number[]): any { return args.reduce((a, b) => a + b, 0); }`,
    // Destructured parameter properly typed, return any
    `function f({ a, b }: { a: number; b: number }): any { return a + b; }`,
  ],
  invalid: [
    // Function declaration
    {
      code: `function processData(x: any): any {
  return x.value + x.extra;
}`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Multiple params
    {
      code: `function merge(a: any, b: any): any {
  return { ...a, ...b };
}`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Arrow function
    {
      code: `const handler = (event: any): any => event.payload;`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Function expression
    {
      code: `const fn = function(x: any, y: any): any {
  return x + y;
};`,
      errors: [{ messageId: "lazyAny" }],
    },
    // TSFunctionType
    {
      code: `type Handler = (req: any, res: any) => any;`,
      errors: [{ messageId: "lazyAny" }],
    },
    // AssignmentPattern — arrow function
    {
      code: `const fn = (x: any = 1): any => x;`,
      errors: [{ messageId: "lazyAny" }],
    },
    // AssignmentPattern — function declaration
    {
      code: `function f(x: any = 0): any { return x; }`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Rest parameter
    {
      code: `function f(...args: any): any { return args; }`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Destructured object parameter
    {
      code: `function f({ a, b }: any): any { return a + b; }`,
      errors: [{ messageId: "lazyAny" }],
    },
    // Destructured array parameter
    {
      code: `function f([a, b]: any): any { return a + b; }`,
      errors: [{ messageId: "lazyAny" }],
    },
    // TSDeclareFunction
    {
      code: `declare function external(x: any): any;`,
      errors: [{ messageId: "lazyAny" }],
    },
    // TSMethodSignature
    {
      code: `interface I { handle(x: any): any }`,
      errors: [{ messageId: "lazyAny" }],
    },
    // MethodDefinition
    {
      code: `class C { handle(x: any): any { return x; } }`,
      errors: [{ messageId: "lazyAny" }],
    },
  ],
});
