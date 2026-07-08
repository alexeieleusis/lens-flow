import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutate-iteration-callback-argument.js";

ruleTester.run("no-mutate-iteration-callback-argument", rule, {
  valid: [
    `function applyDiscountsSafe(items: ReadonlyArray<Item>, discount: number): Item[] {
  return items.map(item => ({ ...item, price: item.price * discount }));
}`,
    `const results = items.map(item => ({
      ...item,
      status: "processed"
    }));`,
    `items.forEach(item => {
  console.log(item.name);
});`,
    `const doubled = nums.map(n => n * 2);`,
    `items.filter(item => item.active).map(item => item.name);`,
    `const fn = (x: { a: number }) => x.a + 1;
items.map(fn);`,
    `items.map(item => {
  const fn = () => { item.price = 1; };
  return item;
});`,
  ],
  invalid: [
    {
      code: `function applyDiscounts(items: Item[], discount: number) {
  return items.map(item => {
    item.price *= discount;
    return item;
  });
}`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
    {
      code: `items.forEach(item => {
  item.count++;
});`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
    {
      code: `const result = items.map(item => {
  item.status = "done";
  item.count = item.count + 1;
  return item;
});`,
      errors: [{ messageId: "mutateCallbackArg" }, { messageId: "mutateCallbackArg" }],
    },
    {
      code: `items.reduce((acc, item) => {
  item.visited = true;
  return acc;
}, {});`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
    {
      code: `items.filter(item => {
  item.touched = true;
  return item.active;
});`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
    {
      code: `items.flatMap(item => {
  item.expanded = true;
  return [item];
});`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
    {
      code: `items.map(function(item) {
  item.price = 1;
  return item;
});`,
      errors: [{ messageId: "mutateCallbackArg" }],
    },
  ],
});
