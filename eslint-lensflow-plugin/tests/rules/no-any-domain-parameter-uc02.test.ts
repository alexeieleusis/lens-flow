import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-domain-parameter-uc02.js";

ruleTester.run("no-any-domain-parameter-uc02", rule, {
  valid: [
    `type Item = { price: number; quantity: number };
function processItem(item: Item) {
  return item.price * item.quantity;
}`,
    `type Item = { price: number; quantity: number };
function processItems(items: Item[]) {
  return items.map((i) => i.price * i.quantity);
}`,
    `function add(a: number, b: number) {
  return a + b;
}`,
    `const fn = (x: string): void => {
  console.log(x);
};`,
    `function handle(data: unknown) {
  if (typeof data === "string") return data;
  return null;
}`,
  ],
  invalid: [
    {
      code: `function processItem(item: any) {
  return item.price * item.quantity;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const process = (data: any) => {
  return data.value;
};`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function processItems(items: any[]) {
  return items.map((i) => i.price);
}`,
      errors: [{ messageId: "anyArrayParam" }],
    },
    {
      code: `const handler = function (payload: any) {
  return payload.id;
};`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
