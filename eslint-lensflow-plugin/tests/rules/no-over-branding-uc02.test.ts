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
    `type Foo = string & { readonly foo: number };
type Bar = string & { readonly bar: string };
type Baz = string & { readonly baz: boolean };
type Qux = string & { readonly qux: symbol };`,
    {
      code: `type FirstName = string & { readonly __brand: "FirstName" };
type LastName  = string & { readonly __brand: "LastName" };
type Address   = string & { readonly __brand: "Address" };
type Phone     = string & { readonly __brand: "Phone" };`,
      options: [{ maxBrandsPerPrimitive: 5 }],
    },
    // Near-miss patterns that should NOT trigger
    `type Foo = string | number`,
    `type Foo = { a: number } & { b: string }`,
    `type Foo = string & number & { readonly __brand: "Foo" }`,
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
      code: `type A = string & { __brand: "A" };
type B = string & { __brand: "B" };
type C = string & { __brand: "C" };
type D = string & { __brand: "D" };
type E = string & { __brand: "E" };`,
      errors: [
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
      ],
    },
    {
      code: `type Score = number & { readonly __brand: "Score" };
type Rating  = number & { readonly __brand: "Rating" };
type Age     = number & { readonly __brand: "Age" };`,
      options: [{ maxBrandsPerPrimitive: 2 }],
      errors: [
        { messageId: "overBranding" },
        { messageId: "overBranding" },
        { messageId: "overBranding" },
      ],
    },
  ],
});
