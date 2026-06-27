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
  ],
});
