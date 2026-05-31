import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overly-complex-bound.js";

ruleTester.run("no-overly-complex-bound", rule, {
  valid: [
    // Simple interface without constructor signature
    `interface Config {
      name: string;
      value: number;
    }`,
    // Correct: split interfaces with 2-member intersection (below threshold)
    `interface Constructable<T> { new(): T }
interface HasId { id: string }
function process<T extends Constructable<T> & HasId>(x: T): void {}`,
    // Type literal with only 2 properties (below threshold)
    `type Pair = { first: string; second: number };`,
    // Intersection with only 2 members
    `function foo<T extends { a: string } & { b: number }>(x: T): void {}`,
    // Interface with only constructor signature, no nested properties
    `interface Newable<T> { new(): T }`,
    // Interface with constructor and one simple property
    `interface Base<T> {
      new(): T;
      name: string;
    }`,
  ],
  invalid: [
    // Antipattern: interface with construct signature + nested type literal with 3 properties
    {
      code: `interface Requirements<T> {
        new(): T;
        prototype: {
          id: string;
          createdAt: Date;
          toJSON: () => string;
        };
      }
      function process<T extends Requirements<T>>(x: T): void {}`,
      errors: [{ messageId: "complexInterfaceBound" }],
    },
    // Type parameter with 3+ intersection members
    {
      code: `function foo<T extends { a: string } & { b: number } & { c: boolean }>(x: T): void {}`,
      errors: [{ messageId: "complexIntersection" }],
    },
    // Type parameter with type literal constraint having 3+ properties
    {
      code: `function bar<T extends { a: string; b: number; c: boolean }>(x: T): void {}`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Type parameter with deeply nested constraint (depth >= 2)
    {
      code: `function baz<T extends { a: { b: { c: string } } }>(x: T): void {}`,
      errors: [{ messageId: "deepNesting" }],
    },
    // Type literal with 3+ properties and deep nesting triggers both
    {
      code: `function qux<T extends { a: string; b: number; c: { deep: { value: string } } }>(x: T): void {}`,
      errors: [
        { messageId: "complexTypeLiteral" },
        { messageId: "deepNesting" },
      ],
    },
    // Interface with constructor and deeply nested property (depth >= 2)
    {
      code: `interface Service<T> {
        new(): T;
        config: {
          options: {
            level: string;
          };
        };
      }`,
      errors: [{ messageId: "complexInterfaceBound" }],
    },
  ],
});
