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
  ],
});
