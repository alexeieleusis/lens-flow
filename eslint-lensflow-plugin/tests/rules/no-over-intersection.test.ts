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
  ],
  invalid: [
    // 6 direct members (>= 4) and 6 flattened (>= 6) — both errors fire
    {
      code: `type Complex = A & B & C & D & E & F;`,
      errors: [
        { messageId: "tooManyDirect" },
        { messageId: "tooManyFlattened" },
      ],
    },
    // 7 direct members including inline literal — from antipattern snippet
    {
      code: `type Complex = A & B & C & D & E & F & { extra: string };
function process(x: Complex) { /* ... */ }`,
      errors: [
        { messageId: "tooManyDirect" },
        { messageId: "tooManyFlattened" },
      ],
    },
    // Deeply nested: outer has 6 flattened, inner has 4 direct
    {
      code: `type Deep = A & B & (C & D & E & F);`,
      errors: [
        { messageId: "tooManyFlattened" },
        { messageId: "tooManyDirect" },
      ],
    },
    // Only flattened exceeds: 2 direct, 6 flattened, inner intersections each have 3
    {
      code: `type Shallow = (A & B & C) & (D & E & F);`,
      errors: [{ messageId: "tooManyFlattened" }],
    },
    // Exactly 4 direct members triggers the direct threshold
    {
      code: `type JustOver = A & B & C & D;`,
      errors: [{ messageId: "tooManyDirect" }],
    },
  ],
});
