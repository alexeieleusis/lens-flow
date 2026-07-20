// eslint-plugin/tests/rules/no-overly-complex-infer-chain-t63.test.ts
import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overly-complex-infer-chain-t63.js";

ruleTester.run("no-overly-complex-infer-chain-t63", rule, {
  valid: [
    // Single level infer — under threshold
    "type ParseOne<S> = S extends `${infer H}` ? H : never;",
    // Non-template extendsType — should not trigger
    "type Map<T> = T extends Array<infer U> ? U[] : never;",
    // No infer at all — not our concern
    "type Simple<S> = S extends string ? S : never;",
    // Two levels of template infer — under default maxDepth 3
    "type T2<S> = S extends `${infer H1},${infer R1}` ? R1 extends `${infer H2}` ? [H1, H2] : never : never;",
    // Three levels — equals default maxDepth 3, so valid
    "type T3<S> = S extends `${infer H1},${infer R1}` ? R1 extends `${infer H2},${infer R2}` ? R2 extends `${infer H3}` ? [H1, H2, H3] : never : never : never;",
    // Union-wrapped infer in template literal — exercises TSUnionType branch in containsInfer
    "type UnionInfer<S> = S extends `${infer U | string}` ? U : never;",
    // Intersection-wrapped infer in template literal — exercises TSIntersectionType branch
    "type IntersectionInfer<S> = S extends `${string & infer U}` ? U : never;",
  ],
  invalid: [
    // Four levels of nested infer conditionals — exceeds default maxDepth 3
    {
      code: "type ParseCSV<S> = S extends `${infer H1},${infer Rest1}`\n" +
        "  ? Rest1 extends `${infer H2},${infer Rest2}`\n" +
        "  ? Rest2 extends `${infer H3},${infer Rest3}`\n" +
        "  ? Rest3 extends `${infer H4}`\n" +
        "  ? [H1, H2, H3, H4]\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never;",
      errors: [{ messageId: "complexInferChain" }],
    },
    // Five levels — clearly over threshold
    {
      code: "type Deep<S> = S extends `${infer A},${infer B}`\n" +
        "  ? B extends `${infer C},${infer D}`\n" +
        "  ? D extends `${infer E},${infer F}`\n" +
        "  ? F extends `${infer G},${infer H}`\n" +
        "  ? [A, C, E, G]\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never;",
      errors: [{ messageId: "complexInferChain" }],
    },
    // Two levels with custom maxDepth of 1
    {
      code: "type AtLimit<S> = S extends `${infer H1},${infer R1}`\n" +
        "  ? R1 extends `${infer H2}`\n" +
        "  ? [H1, H2]\n" +
        "  : never\n" +
        "  : never;",
      options: [{ maxDepth: 1 }],
      errors: [{ messageId: "complexInferChain" }],
    },
    // Union-wrapped infer in template literal — 4 levels, exceeds maxDepth 3
    {
      code: "type UnionDeep<S> = S extends `${infer A | string}`\n" +
        "  ? A extends `${infer B | string}`\n" +
        "  ? B extends `${infer C | string}`\n" +
        "  ? C extends `${infer D | string}`\n" +
        "  ? [A, B, C, D]\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never\n" +
        "  : never;",
      errors: [{ messageId: "complexInferChain" }],
    },
    // False-branch recursion — chain continues through falseType, exceeds maxDepth 3
    {
      code: "type FalseBranch<S> = S extends `${infer H1}`\n" +
        "  ? H1\n" +
        "  : S extends `${infer H2}`\n" +
        "  ? H2\n" +
        "  : S extends `${infer H3}`\n" +
        "  ? H3\n" +
        "  : S extends `${infer H4}`\n" +
        "  ? H4\n" +
        "  : never;",
      errors: [{ messageId: "complexInferChain" }],
    },
  ],
});
