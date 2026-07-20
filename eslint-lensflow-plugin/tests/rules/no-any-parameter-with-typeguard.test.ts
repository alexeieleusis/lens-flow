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
    // Nested function shadows outer any param — should NOT report
    `function outer(x: any) {
      const inner = (x: string | number) => {
        if (typeof x === "string") return x;
        return String(x);
      };
      return inner(x);
    }`,
    // Arrow function shadowing with instanceof
    `function outer(data: any) {
      const fn = (data: Date | string) => {
        if (data instanceof Date) return data;
        return data;
      };
      return fn(data);
    }`,
    // Nested function declaration shadowing
    `function outer(x: any) {
      function inner(x: string | number) {
        if (typeof x === "string") return x;
        return x;
      }
      return inner(42);
    }`,
    // Expression-bodied arrow with no typeguard on any param
    `const fn = (x: any) => x;`,
    // typeof on member access is NOT a typeguard on the parameter itself
    `function handle(obj: any) {
      if (typeof obj.foo === "undefined") {
        return null;
      }
      return obj;
    }`,
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
      // Expression-bodied arrow with typeof inside a ternary
      code: `const fn = (x: any) => typeof x === "string" ? x.toUpperCase() : String(x);`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      // AssignmentPattern (default parameter)
      code: `function f(x: any = 1) {
        if (typeof x === "string") {
          console.log(x.toUpperCase());
        }
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      // RestElement
      code: `function f(...args: any) {
        if (args instanceof Array) {
          console.log(args.length);
        }
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      // Destructuring with any type — typeof on the whole parameter
      code: `function f(params: any) {
        if (typeof params === "object") {
          const { a } = params;
          console.log(a);
        }
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
    {
      // TSParameterProperty
      code: `class C {
        constructor(public x: any) {
          if (typeof x === "string") {
            console.log(x.toUpperCase());
          }
        }
      }`,
      errors: [{ messageId: "anyParamWithTypeguard" }],
    },
  ],
});
