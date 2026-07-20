import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-unique-symbol-brand.js";

ruleTester.run("prefer-unique-symbol-brand", rule, {
  valid: [
    `declare const __emailBrand: unique symbol;
type Email = string & { readonly [__emailBrand]: true };`,
    `interface Normal {
  name: string;
  age: number;
}`,
    `type UserId = string & { readonly id: number };`,
    `type Tag = string & { readonly __brand: typeof someSymbol };`,
  ],
  invalid: [
    {
      code: `type Email = string & { readonly __brand: "Email" };`,
      errors: [{ messageId: "stringBrandForgery" }],
    },
    {
      code: `type UserId = string & { readonly __Branded: "UserId" };`,
      errors: [{ messageId: "stringBrandForgery" }],
    },
    {
      code: `type OrderId = string & { readonly orderBrand: "OrderId" };`,
      errors: [{ messageId: "stringBrandForgery" }],
    },
    {
      code: `type Email = string & { readonly "__brand": "Email" };`,
      errors: [{ messageId: "stringBrandForgery" }],
    },
    {
      code: `type Email = string & { __brand: "Email" };`,
      errors: [{ messageId: "stringBrandForgery" }],
    },
  ],
});
