import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-excessive-intersection-chain.js";

ruleTester.run("no-excessive-intersection-chain", rule, {
  valid: [
    `type Small = A & B & C;`,
    `type AtLimit = A & B & C & D;`,
    `type Decomposed = Part1 & Part2;
type Part1 = A & B & C;
type Part2 = D & E & F;`,
    `type Nested = (A & B) & (C & D);`,
    {
      code: `type SixMembers = A & B & C & D & E & F;`,
      options: [{ maxMembers: 10 }],
    },
    // Function parameter with acceptable intersection
    `function f(x: A & B & C) {}`,
    `function f(x: A & B & C & D) {}`,
    // Function return type with acceptable intersection
    `function f(): A & B & C { return null!; }`,
    `function f(): A & B & C & D { return null!; }`,
    // Variable annotation with acceptable intersection
    `const x: A & B & C = null!;`,
    `const x: A & B & C & D = null!;`,
  ],
  invalid: [
    {
      code: `type Complex = A & B & C & D & E & F;`,
      errors: [{ messageId: "excessiveChain" }],
    },
    {
      code: `type Huge = A & B & C & D & E;`,
      errors: [{ messageId: "excessiveChain" }],
    },
    {
      code: `type TooMany = X & Y & Z & W & V & U & T;`,
      errors: [{ messageId: "excessiveChain" }],
    },
    {
      code: `type CustomThreshold = A & B & C & D & E & F;`,
      options: [{ maxMembers: 5 }],
      errors: [{ messageId: "excessiveChain" }],
    },
    // Function parameter with excessive intersection
    {
      code: `function f(x: A & B & C & D & E) {}`,
      errors: [{ messageId: "excessiveChain" }],
    },
    // Function return type with excessive intersection
    {
      code: `function f(): A & B & C & D & E { return null!; }`,
      errors: [{ messageId: "excessiveChain" }],
    },
    // Variable annotation with excessive intersection
    {
      code: `const x: A & B & C & D & E = null!;`,
      errors: [{ messageId: "excessiveChain" }],
    },
  ],
});
