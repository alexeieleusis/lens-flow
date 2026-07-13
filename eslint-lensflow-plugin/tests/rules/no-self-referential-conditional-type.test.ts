import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-self-referential-conditional-type.js";

ruleTester.run("no-self-referential-conditional-type", rule, {
  valid: [
    // Accumulating pattern — safe recursion via tail-call style
    `type Reverse<A extends unknown[], R extends unknown[] = []> =
      A extends [infer H, ...infer T]
        ? Reverse<T, [H, ...R]>
        : R;`,
    // Non-recursive conditional type
    `type IsArray<T> = T extends any[] ? true : false;`,
    // Conditional type referencing a different alias
    `type Foo<T> = T extends string ? Bar<T> : T;
    type Bar<T> = T;`,
    // Self-reference without type parameter references (not truly recursive on params)
    `type Maybe<T> = T extends null ? Maybe<null> : T;`,
    // Simple type alias without generics
    `type StringOrNumber = string | number;`,
    // Self-reference but with literal type, not a type parameter
    `type Wrap<T> = T extends string ? Wrap<"literal"> : T;`,
    // Conditional inside generic type argument — not self-referential
    `type SafePromise<T> = Promise<T extends string ? number : T>;`,
    // Conditional inside Array type argument — references different alias
    `type SafeArray<T> = Array<T extends number ? Other<T> : T>;`,
  ],
  invalid: [
    // Classic self-referential with type parameter in recursive call
    {
      code: `type Reverse<T extends unknown[]> =
        T extends [infer H, ...infer R] ? [...Reverse<R>, H] : T;`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Self-reference in false branch
    {
      code: `type Flatten<T> = T extends (infer U)[] ? U : Flatten<T>;`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Conditional nested inside type argument of a generic wrapper
    {
      code: `type Foo<T> = Promise<T extends string ? Foo<T> : T>;`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Conditional nested inside Array type argument
    {
      code: `type Wrap<T> = Array<T extends number ? Wrap<T> : T>;`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Nested conditionals with self-reference
    {
      code: `type Last<T extends unknown[]> =
      T extends [...infer _, infer tail]
        ? Last<[tail]>
        : T;`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Multiple type params, self-reference uses one of them
    {
      code: `type MapTuple<T extends unknown[], U> =
      T extends [infer H, ...infer R]
        ? [U, ...MapTuple<R, U>]
        : [];`,
      errors: [{ messageId: "selfReferential" }],
    },
    // Parenthesized conditional type with self-reference
    {
      code: `type Foo<T> = (T extends string ? Foo<T> : T);`,
      errors: [{ messageId: "selfReferential" }],
    },
  ],
});
