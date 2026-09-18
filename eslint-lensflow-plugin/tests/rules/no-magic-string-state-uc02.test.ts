import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-magic-string-state-uc02.js";

ruleTester.run("no-magic-string-state-uc02", rule, {
  valid: [
    `function isShipped(o: { state: string }) {
      return o.state === "shipped";
    }`,
    `function check(a: { x: string }, b: { y: string }) {
      return a.x === "a" && b.y === "b";
    }`,
    `type OrderState = "pending" | "shipped" | "cancelled";
function isShipped(o: { state: OrderState }) {
  return o.state === "shipped";
}`,
    `function check(status: string) {
      return status === "ok" && status === "ok";
    }`,
    // Nested function scope isolation: outer has o.state === "shipped", inner has o.state === "pending" x2.
    // Without scope isolation, combined distinct values for o.state would be >= 2 and trigger the rule.
    `function process(o: { state: string }) {
      const fn = (o: { state: string }) => {
        return o.state === "pending" && o.state === "pending";
      };
      return o.state === "shipped" && fn(o);
    }`,
    // == operator (loose equality) — single value, should not trigger
    `function isShipped(o: { state: string }) {
      return o.state == "shipped";
    }`,
    // Type-guard narrowing an `unknown` value against a literal union type:
    // the comparisons ARE the exhaustiveness check, not a magic-string antipattern.
    // See https://github.com/alexeieleusis/agentic-neighboku-lensflow/pull/16#discussion_r3873407050
    `type PieceType = "Shapes" | "Faces";
function pieceTypeOr(fallback: PieceType, value: unknown): PieceType {
  return value === "Shapes" || value === "Faces" ? value : fallback;
}`,
    // User-defined type predicate validating `unknown` against a literal
    // union: the comparisons are the runtime check backing `value is PieceType`.
    `type PieceType = "Shapes" | "Faces";
function isPieceType(value: unknown): value is PieceType {
  return value === "Shapes" || value === "Faces";
}`,
    // Same idiom, expressed as a switch instead of ||.
    `type PieceType = "Shapes" | "Faces";
function isPieceType(value: unknown): value is PieceType {
  switch (value) {
    case "Shapes":
    case "Faces":
      return true;
    default:
      return false;
  }
}`,
    // Variable already typed as a string-literal union: the comparisons are
    // consuming an existing union type, not asking for one to be introduced.
    `type OrderState = "pending" | "shipped" | "cancelled";
function isPendingOrShipped(o: { state: OrderState }) {
  return o.state === "pending" || o.state === "shipped";
}`,
    // Same idiom, expressed as a switch instead of ||.
    `type OrderState = "pending" | "shipped" | "cancelled";
function process(order: { state: OrderState }) {
  switch (order.state) {
    case "pending":
      break;
    case "shipped":
      break;
    case "cancelled":
      break;
  }
}`,
  ],
  invalid: [
    {
      code: `function isShipped(o: { state: string }) {
        return o.state === "shipped" || o.state === "SHIPPED" || o.state === "shipped!";
      }`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
    {
      code: `function getStatusLabel(status: string) {
        if (status === "pending") return "Pending";
        if (status === "shipped") return "Shipped";
        return "Unknown";
      }`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
    {
      code: `const handler = (o: { state: string }) => {
        if (o.state === "new") return 1;
        if (o.state === "old") return 2;
        return 0;
      };`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
    {
      code: `function process(order: { state: string }) {
        switch (order.state) {
          case "pending":
            break;
          case "shipped":
            break;
          case "cancelled":
            break;
        }
      }`,
      errors: [{ messageId: "magicSwitch" }],
    },
    // == operator (loose equality) — multiple values, should trigger
    {
      code: `function check(o: { state: string }) {
        return o.state == "shipped" || o.state == "SHIPPED";
      }`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
    // A disjunction where a DIFFERENT variable can satisfy the `||` on its
    // own must not be exempted as value-preserving: `y === "b"` can make the
    // condition true without validating `x`, so `x`'s own two-literal check
    // is still a real magic-string antipattern.
    // See https://github.com/alexeieleusis/lens-flow/pull/342#discussion_r4047502242
    {
      code: `function pick(fallback: string, x: string, y: string): string {
        return x === "a" || y === "b" || x === "c" ? x : fallback;
      }`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
    // Two distinct computed properties on the same object (`o["kind"]`,
    // `o["state"]`) must not share a cache key. `kind` is an existing
    // literal union (exempt), but `state` is a plain string compared
    // against magic strings and must still be flagged.
    {
      code: `type Kind = "a" | "b";
      function process(o: { kind: Kind; state: string }) {
        return o["kind"] === "a" || o["state"] === "x" || o["state"] === "y";
      }`,
      errors: [
        { messageId: "magicComparison" },
        { messageId: "magicComparison" },
      ],
    },
  ],
});
