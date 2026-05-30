import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-index-signature.js";

ruleTester.run("no-any-index-signature", rule, {
  valid: [
    `type GoodConfig = { [key: string]: string | number | boolean };`,
    `type SafeMap = { [key: string]: string };`,
    `interface SafeRecord {
      [key: number]: { value: string };
    }`,
    `type Mixed = { [key: string]: string | number };`,
  ],
  invalid: [
    {
      code: `type BadConfig = { [key: string]: any };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `interface BadRecord {
        [key: string]: any;
      }`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type MixedAny = { [key: string]: string | any | number };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
  ],
});
