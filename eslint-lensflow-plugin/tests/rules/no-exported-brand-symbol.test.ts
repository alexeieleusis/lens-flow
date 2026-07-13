import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-exported-brand-symbol.js";

ruleTester.run("no-exported-brand-symbol", rule, {
  valid: [
    `declare const __userBrand: unique symbol;
export type UserId = string & { readonly [__userBrand]: true };`,
    `const __userBrand = Symbol("UserId");
type UserId = string & { readonly [__userBrand]: true };`,
    `export const __userBrand = "not-a-symbol";`,
    `export const config = getConfig();`,
  ],
  invalid: [
    {
      code: `export const __userBrand = Symbol("UserId");
export type UserId = string & { readonly [__userBrand]: true };`,
      errors: [{ messageId: "exportedBrandSymbol" }],
    },
    {
      code: `export const __brand = Symbol("Brand");`,
      errors: [{ messageId: "exportedBrandSymbol" }],
    },
    {
      code: `export const __a = Symbol("A"), __b = Symbol("B");`,
      errors: [
        { messageId: "exportedBrandSymbol" },
        { messageId: "exportedBrandSymbol" },
      ],
    },
  ],
});
