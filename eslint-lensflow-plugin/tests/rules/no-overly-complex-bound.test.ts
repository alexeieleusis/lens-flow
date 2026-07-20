import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overly-complex-bound.js";

ruleTester.run("no-overly-complex-bound", rule, {
  valid: [
    // Simple interface without constructor signature
    `interface Config {
      name: string;
      value: number;
    }`,
    // Interface without constructor but with deep nesting (should NOT flag)
    `interface DeepConfig {
      options: {
        level: {
          nested: string;
        };
      };
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
    // Raising maxProperties threshold suppresses report for 3-property type literal
    {
      code: `function bar<T extends { a: string; b: number; c: boolean }>(x: T): void {}`,
      options: [{ maxProperties: 4 }],
    },
    // Raising maxIntersectionMembers threshold suppresses report for 3-member intersection
    {
      code: `function foo<T extends { a: string } & { b: number } & { c: boolean }>(x: T): void {}`,
      options: [{ maxIntersectionMembers: 4 }],
    },
    // Raising maxNestingDepth threshold suppresses report for depth-2 nesting
    {
      code: `function baz<T extends { a: { b: { c: string } } }>(x: T): void {}`,
      options: [{ maxNestingDepth: 4 }],
    },
    // Class type parameter with 2 properties (below threshold)
    `class Foo<T extends { a: string; b: number }> {}`,
    // Arrow function type parameter with 2 properties (below threshold)
    `const fn = <T extends { a: string; b: number }>() => {}`,
    // TSFunctionType inside type alias with 2 properties (below threshold)
    `type Handler = <T extends { a: string; b: number }>() => void`,
    // Parenthesized type with 2 properties (below threshold) — unwrapped correctly
    `function foo<T extends ({ a: string; b: number })>(x: T): void {}`,
    // Union with non-object member and 2-property literal — unwrapped correctly
    `function foo<T extends string | { a: string; b: number }>(x: T): void {}`,
    // Intersection nested inside a parenthesized type, 2 members (below threshold)
    `function foo<T extends ({ a: string } & { b: number })>(x: T): void {}`,
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
    // Lowering maxProperties threshold triggers on 2-property type literal
    {
      code: `type Pair = { first: string; second: number };
function bar<T extends { first: string; second: number }>(x: T): void {}`,
      options: [{ maxProperties: 1 }],
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Lowering maxIntersectionMembers threshold triggers on 2-member intersection
    {
      code: `function foo<T extends { a: string } & { b: number }>(x: T): void {}`,
      options: [{ maxIntersectionMembers: 1 }],
      errors: [{ messageId: "complexIntersection" }],
    },
    // Lowering maxNestingDepth threshold triggers on depth-1 nesting
    {
      code: `function qux<T extends { a: { b: string } }>(x: T): void {}`,
      options: [{ maxNestingDepth: 1 }],
      errors: [{ messageId: "deepNesting" }],
    },
    // Class type parameter with 3+ properties
    {
      code: `class Foo<T extends { a: string; b: number; c: boolean }> {}`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Arrow function type parameter with 3+ properties
    {
      code: `const fn = <T extends { a: string; b: number; c: boolean }>() => {}`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // TSFunctionType inside type alias with 3+ properties
    {
      code: `type Handler = <T extends { a: string; b: number; c: boolean }>() => void`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Parenthesized type literal with 3+ properties — must unwrap and detect
    {
      code: `function foo<T extends ({ a: string; b: number; c: boolean })>(x: T): void {}`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Union-wrapped constraint with 3+ property literal — must unwrap and detect
    {
      code: `function foo<T extends string | { a: string; b: number; c: boolean }>(x: T): void {}`,
      errors: [{ messageId: "complexTypeLiteral" }],
    },
    // Intersection nested inside a parenthesized type, 3+ members — must unwrap and detect
    {
      code: `function foo<T extends ({ a: string } & { b: number } & { c: boolean })>(x: T): void {}`,
      errors: [{ messageId: "complexIntersection" }],
    },
  ],
});
