import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-recursive-type-without-base-case.js";

ruleTester.run("no-recursive-type-without-base-case", rule, {
  valid: [
    `type Flatten<T> = T extends Array<infer Item> ? Flatten<Item> : T;`,
    `type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T;`,
    `type Identity<T> = T extends string ? T : number;`,
    `type NotConditional<T> = T | string;`,
    `type DeepFlatten<T> = T extends (infer U)[] ? DeepFlatten<U> : T;`,
    `type IntersectReduce<T> = T extends infer U & object ? IntersectReduce<U & string> : T;`,
    `type TupleReduce<T> = T extends [infer U, ...any[]] ? TupleReduce<[U, string]> : T;`,
  ],
  invalid: [
    {
      code: `type AlsoBad<T> = T extends object ? AlsoBad<T[keyof T]> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `type BareRec<T> = T extends object ? BareRec<T> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `type BothBranches<T> = T extends object ? BothBranches<T> : BothBranches<T>;`,
      errors: [{ messageId: "noTerminatingBranch" }],
    },
    {
      code: `type DeepBad<T> = T extends Array<infer U> ? DeepBad<U[keyof U]> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `namespace TE { type Bad<T> = T extends object ? TE.Bad<T[keyof T]> : T; }`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `type IntersectBad<T> = T extends infer U & object ? IntersectBad<T & string> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `type TupleBad<T> = T extends [infer U, any] ? TupleBad<[T, string]> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
    {
      code: `type Multi<T, U> = T extends Array<infer Item> ? Multi<Item, U> : T;`,
      errors: [{ messageId: "noStructuralReduction" }],
    },
  ],
});
