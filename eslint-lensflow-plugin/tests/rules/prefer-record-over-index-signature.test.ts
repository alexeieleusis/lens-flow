import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-record-over-index-signature.js";

ruleTester.run("prefer-record-over-index-signature", rule, {
  valid: [
    `type Tags = Record<string, string>;`,
    `interface Tags {
      name: string;
      [key: string]: string;
    }`,
    `interface Config {
      timeout: number;
      retries: number;
    }`,
    `type Multi = {
      [key: string]: number;
      [key: number]: string;
    }`,
  ],
  invalid: [
    {
      code: `interface Tags { [key: string]: string }`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `interface Counters { [key: number]: number }`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type Tags = { [key: string]: string }`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `const x: { [key: number]: boolean } = {}`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `function foo(): { [key: string]: number } { return {}; }`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `function foo(x: { [key: string]: number }) {}`,
      errors: [{ messageId: "preferRecord" }],
    },
  ],
});
