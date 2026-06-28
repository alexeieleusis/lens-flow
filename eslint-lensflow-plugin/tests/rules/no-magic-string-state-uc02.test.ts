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
  ],
});
