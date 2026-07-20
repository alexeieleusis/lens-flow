import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-value-wrapper-nominal.js";

ruleTester.run("no-value-wrapper-nominal", rule, {
  valid: [
    `type UserId = string & { readonly brand: unique symbol };`,
    `type State = { status: string; count: number };`,
    `type Wrapper = { value: number };`,
    `type Flag = { value: boolean };`,
    `interface Config { value: string; other: boolean }`,
    `type Foo = { "value": number };`,
  ],
  invalid: [
    {
      code: `type UserId = { value: string };`,
      errors: [{ messageId: "valueWrapperNominal" }],
    },
    {
      code: `type Foo = { "value": string };`,
      errors: [{ messageId: "valueWrapperNominal" }],
    },
    {
      code: `type Email = { value: string };

type Phone = { value: string };`,
      errors: [
        { messageId: "valueWrapperNominal" },
        { messageId: "valueWrapperNominal" },
      ],
    },
    {
      code: `interface UserId { value: string }`,
      errors: [{ messageId: "valueWrapperNominal" }],
    },
  ],
});
