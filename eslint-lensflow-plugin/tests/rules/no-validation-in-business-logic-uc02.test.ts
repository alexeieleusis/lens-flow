import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-validation-in-business-logic-uc02.js";

ruleTester.run("no-validation-in-business-logic-uc02", rule, {
  valid: [
    // Branded type enforces invariant at construction — no guards needed
    `type Price = Branded<number, "Price">;
type Order = { items: Array<{ price: Price }> };

function calculateTax(order: Order) {
  return order.items.reduce((sum, item) => sum + item.price * 0.1, 0);
}`,
    // Iterator callback with no validation
    `const names = users.map(u => u.name);`,
    // Comparison that's not validation (no throw, not involving callback param vs literal)
    `items.filter(x => x.count > other.count);`,
    // IfStatement with throw outside iterator callback
    `function process(value: number) {
  if (value < 0) throw new Error("negative");
  return value * 2;
}`,
    // Iterator callback with plain throw (no comparison guard) is still a validation leak,
    // but this rule specifically targets the comparison-guard pattern
    // So this is valid for this rule:
    `items.map(x => x.value);`,
    // Nested function inside callback with its own guard + throw should not trigger false positive
    `items.map(x => {
  const validate = (v: number) => {
    if (v < 0) throw new Error("negative");
  };
  return x.value;
})`,
  ],
  invalid: [
    {
      code: `function calculateTax(order: { items: Array<{ price: number }> }) {
  return order.items.reduce((sum, item) => {
    if (item.price < 0) throw new Error("negative price");
    return sum + item.price * 0.1;
  }, 0);
}`,
      errors: [{ messageId: "validationInIterator" }],
    },
    {
      code: `const results = values.map((v) => {
  if (v >= 100) throw new Error("too large");
  return v * 2;
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
    {
      code: `arr.filter((x) => {
  if (x <= 0) throw new Error("must be positive");
  return x > 5;
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
    {
      code: `data.forEach(function (item) {
  if (item.age === 0) throw new Error("invalid age");
  console.log(item);
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
    {
      code: `const ok = items.every((x) => {
  if (x.score !== -1) {
    throw new Error("unexpected sentinel");
  }
  return true;
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
    {
      code: `arr.map((x) => {
  if (x.value >= 0) return x.value * 2;
  else throw new Error("negative value");
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
    // Destructured callback parameter — getParamNames() only extracts Identifiers,
    // so ObjectPattern/ArrayPattern params are missed and validation leaks go unreported
    {
      code: `items.map(({ price }) => {
  if (price < 0) throw new Error("negative price");
  return price;
});`,
      errors: [{ messageId: "validationInIterator" }],
    },
  ],
});
