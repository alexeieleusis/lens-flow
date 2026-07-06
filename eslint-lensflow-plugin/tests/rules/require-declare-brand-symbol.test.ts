import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-declare-brand-symbol.js";

ruleTester.run("require-declare-brand-symbol", rule, {
  valid: [
    `declare const __userBrand: unique symbol;
type UserId = string & { readonly [__userBrand]: true };`,
    `declare const UserIdBrand: unique symbol;
type UserId = string & { readonly [UserIdBrand]: true };`,
    `const foo = "not a symbol";`,
    `const regularSym = Symbol("test");`,
    `const mySymbol = Symbol("description");`,
  ],
  invalid: [
    {
      code: `const __userBrand = Symbol("UserId");
type UserId = string & { readonly [__userBrand]: true };`,
      output: `declare const __userBrand: unique symbol;
type UserId = string & { readonly [__userBrand]: true };`,
      errors: [{ messageId: "requireDeclareBrand" }],
    },
    {
      code: `const UserIdBrand = Symbol("UserId");`,
      output: `declare const UserIdBrand: unique symbol;`,
      errors: [{ messageId: "requireDeclareBrand" }],
    },
    {
      code: `const __itemBrand: symbol = Symbol("ItemId");`,
      output: `declare const __itemBrand: unique symbol;`,
      errors: [{ messageId: "requireDeclareBrand" }],
    },
    {
      code: `const myVar: symbol = Symbol("test");`,
      errors: [{ messageId: "symbolTypedBrand" }],
    },
  ],
});
