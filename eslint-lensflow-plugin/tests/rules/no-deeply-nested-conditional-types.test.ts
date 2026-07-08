import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deeply-nested-conditional-types.js";

ruleTester.run("no-deeply-nested-conditional-types", rule, {
  valid: [
    // Correct pattern: using intermediate named type aliases
    `type UnwrapLevel1<T> = T extends (infer U)[] ? U : never;
type UnwrapLevel2<T> = UnwrapLevel1<UnwrapLevel1<T>>;
type UnwrapLevel4<T> = UnwrapLevel2<UnwrapLevel2<T>>;`,
    // 3 levels of nesting is within the default limit
    `type G<T> = T extends (infer A)[]
      ? A extends (infer B)[]
        ? B extends (infer C)[]
          ? C
          : never
        : never
      : never;`,
    // 4 levels of nesting equals the default maxDepth, so it's valid
    `type F<T> = T extends (infer A)[]
      ? A extends (infer B)[]
        ? B extends (infer C)[]
          ? C extends (infer D)[]
            ? D
            : never
          : never
        : never
      : never;`,
    // 5 levels is valid when maxDepth is raised to 5
    {
      code: `type F<T> = T extends (infer A)[]
    ? A extends (infer B)[]
      ? B extends (infer C)[]
        ? C extends (infer D)[]
          ? D extends (infer E)[]
            ? E
            : never
          : never
        : never
      : never
    : never;`,
      options: [{ maxDepth: 5 }],
    },
    // exactly at custom maxDepth boundary (2 levels with maxDepth 2)
    {
      code: `type H<T> = T extends (infer A)[] ? A extends (infer B)[] ? B : never : never;`,
      options: [{ maxDepth: 2 }],
    },
  ],
  invalid: [
    // 5 levels of nesting exceeds default maxDepth of 4
    {
      code: `type F<T> = T extends (infer A)[]
  ? A extends (infer B)[]
    ? B extends (infer C)[]
      ? C extends (infer D)[]
        ? D extends (infer E)[]
          ? E
          : never
        : never
      : never
    : never
  : never;`,
      errors: [{ messageId: "deepNesting" }],
    },
   // 5 levels in a different shape
    {
      code: `type Deep<T> = T extends string
   ? T extends \`prefix-\${infer Rest}\`
     ? Rest extends \`sub-\${infer Inner}\`
       ? Inner extends number | string
         ? Inner extends string
           ? Inner
           : never
         : never
       : never
     : never
   : never;`,
      errors: [{ messageId: "deepNesting" }],
    },
    // 3 levels exceeds custom maxDepth of 2
    {
      code: `type G<T> = T extends (infer A)[]
    ? A extends (infer B)[]
      ? B extends (infer C)[]
        ? C
        : never
      : never
    : never;`,
      options: [{ maxDepth: 2 }],
      errors: [{ messageId: "deepNesting", data: { depth: "3" } }],
    },
   // 5 levels with maxDepth 4 reports depth 5
    {
      code: `type F<T> = T extends (infer A)[]
    ? A extends (infer B)[]
      ? B extends (infer C)[]
        ? C extends (infer D)[]
          ? D extends (infer E)[]
            ? E
            : never
          : never
        : never
      : never
    : never;`,
      options: [{ maxDepth: 4 }],
      errors: [{ messageId: "deepNesting", data: { depth: "5" } }],
    },
    // 5 levels in a function return type
    {
      code: `function resolve<T>(v: T): T extends (infer A)[]
    ? A extends (infer B)[]
      ? B extends (infer C)[]
        ? C extends (infer D)[]
          ? D extends (infer E)[]
            ? E
            : never
          : never
        : never
      : never
    : never { return null as any; }`,
      errors: [{ messageId: "deepNesting" }],
    },
    // 5 levels in a generic constraint
    {
      code: `function unwrap<T extends (unknown extends object
    ? unknown extends {}
      ? unknown extends unknown
        ? unknown extends any
          ? unknown extends unknown
            ? string
            : never
          : never
        : never
      : never
    : never)>(v: T) { return v; }`,
      errors: [{ messageId: "deepNesting" }],
    },
  ],
});
