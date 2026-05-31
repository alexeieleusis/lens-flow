import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-over-branding-uc02.js";

ruleTester.run("no-over-branding-uc02", rule, {
  valid: [
    `type FirstName = string & { readonly __brand: "FirstName" };
type LastName  = string & { readonly __brand: "LastName" };`,
    `type UserId = string & { readonly __brand: "UserId" };
type TeamId = string & { readonly __brand: "TeamId" };
type UserName = string;`,
    `type Score = number & { readonly __brand: "Score" };
type Rating  = number & { readonly __brand: "Rating" };`,
    `type FirstName = string & { readonly __brand: "FirstName" };
type Score     = number & { readonly __brand: "Score" };
type Rating    = number & { readonly __brand: "Rating" };
type Age       = number & { readonly __brand: "Age" };`,
    `type Name = string;
type Age = number;`,
  ],
  invalid: [
    {
      code: `type FirstName = string & { readonly __brand: "FirstName" };
type LastName  = string & { readonly __brand: "LastName" };
type Address   = string & { readonly __brand: "Address" };
type Phone     = string & { readonly __brand: "Phone" };`,
      errors: [
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
      ],
    },
    {
      code: `type Score    = number & { readonly __brand: "Score" };
type Rating   = number & { readonly __brand: "Rating" };
type Age      = number & { readonly __brand: "Age" };
type Balance  = number & { readonly __brand: "Balance" };
type Quantity = number & { readonly __brand: "Quantity" };`,
      errors: [
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
      ],
    },
    {
      code: `type A = string & { __b: "A" };
type B = string & { __b: "B" };
type C = string & { __b: "C" };
type D = string & { __b: "D" };
type E = string & { __b: "E" };`,
      errors: [
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
      ],
    },
  ],
});
