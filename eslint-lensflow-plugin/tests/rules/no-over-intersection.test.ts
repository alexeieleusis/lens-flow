import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-over-intersection.js";

ruleTester.run("no-over-intersection", rule, {
  valid: [
    // Two direct members — well under the default max of 4
    `type Simple = A & B;`,
    // Three direct members — still under maxMembers: 4
    `type Core = A & B & C;`,
    // Nested intersection that flattens to 4 — under maxFlattenedMembers: 6
    `type Nested = A & B & (C & D);`,
    // Correct pattern from spec: broken into composed types (each under threshold)
    `type Core = A & B & C;
type WithExtras = Core & D & E;`,
    // Exactly 4 direct members — at the threshold, allowed
    `type AtLimit = A & B & C & D;`,
    // Exactly 6 flattened members — at the threshold, allowed
    `type AtFlattenLimit = (A & B & C) & (D & E & F);`,
  ],
  invalid: [
    // 6 direct (> 4) triggers; 6 flattened (not > 6) does not
    {
      code: `type Complex = A & B & C & D & E & F;`,
      errors: [
        { messageId: "tooManyDirect" },
      ],
    },
    // 7 direct members including inline literal — from antipattern snippet (both > 4 and > 6)
    {
      code: `type Complex = A & B & C & D & E & F & { extra: string };
function process(x: Complex) { /* ... */ }`,
      errors: [
        { messageId: "tooManyDirect" },
        { messageId: "tooManyFlattened" },
      ],
    },
    // Deeply nested: outer has 8 flattened (> 6), inner has 5 direct (> 4)
    {
      code: `type Deep = A & B & C & (D & E & F & G & H);`,
      errors: [
        { messageId: "tooManyFlattened" },
        { messageId: "tooManyDirect" },
      ],
    },
    // Only flattened exceeds: 3 direct (not > 4), 7 flattened (> 6)
    {
      code: `type Shallow = (A & B) & (C & D) & (E & F & G);`,
      errors: [{ messageId: "tooManyFlattened" }],
    },
    // Exactly 5 direct members — minimum value above threshold
    {
      code: `type JustOver = A & B & C & D & E;`,
      errors: [{ messageId: "tooManyDirect" }],
    },
  ],
});
