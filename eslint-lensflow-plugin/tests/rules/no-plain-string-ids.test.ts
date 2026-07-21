import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-plain-string-ids.js";

ruleTester.run("no-plain-string-ids", rule, {
  valid: [
    // Only one function with bare-string ID — not enough to flag
    `function getUser(id: string) { /* ... */ }`,
    // Uses branded types — correct pattern
    `type UserId = string & { readonly brand: "UserId" };
type OrderId = string & { readonly brand: "OrderId" };
function getUser(id: UserId) { /* ... */ }
function getOrder(id: OrderId) { /* ... */ }`,
    // ID parameter uses non-string type
    `function getUser(id: number) { /* ... */ }
function getOrder(id: number) { /* ... */ }`,
    // Parameter name doesn't match ID pattern
    `function foo(name: string) { /* ... */ }
function bar(label: string) { /* ... */ }`,
    // No type annotation on params
    `function getUser(id) { /* ... */ }
function getOrder(id) { /* ... */ }`,
    // Valid — names ending in "id" that are not IDs (regression test for regex false positives)
    `function draw(grid: string) { /* ... */ }
function dissolve(liquid: string) { /* ... */ }`,
    // More false-positive regression cases
    `function checkIsValid(valid: string) { /* ... */ }
function setWidth(width: string) { /* ... */ }
function getRadius(radius: string) { /* ... */ }`,
    // Valid — single FunctionExpression callback, not enough to flag
    `processArray(items, function(id: string) { return id; })`,
  ],
  invalid: [
    {
      code: `function getUser(id: string) { /* ... */ }
function getOrder(id: string) { /* ... */ }`,
      errors: [{ messageId: "plainStringId" }, { messageId: "plainStringId" }],
    },
    {
      code: `function getUser(userId: string) { /* ... */ }
function getOrder(orderId: string) { /* ... */ }`,
      errors: [{ messageId: "plainStringId" }, { messageId: "plainStringId" }],
    },
    {
      code: `function getUser(id: string) { /* ... */ }
function getOrder(id: string) { /* ... */ }
function getProduct(productId: string) { /* ... */ }`,
      errors: [
        { messageId: "plainStringId" },
        { messageId: "plainStringId" },
        { messageId: "plainStringId" },
      ],
    },
    {
      code: `const getUser = (id: string) => { /* ... */ };
const getOrder = (id: string) => { /* ... */ };`,
      errors: [{ messageId: "plainStringId" }, { messageId: "plainStringId" }],
    },
    {
      code: `processArray(items, function(id: string) { return id; });
processArray(orders, function(id: string) { return id; });`,
      errors: [{ messageId: "plainStringId" }, { messageId: "plainStringId" }],
    },
  ],
});
