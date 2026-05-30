import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-broad-index-signatures.js";

ruleTester.run("no-broad-index-signatures", rule, {
  valid: [
    `interface Tight {
      id: string;
      name: string;
    }`,
    `type Tight = {
      id: string;
      name: string;
    };`,
    `interface Bounded {
      [key: string]: string;
    }`,
    `type Bounded = {
      [key: number]: boolean;
    };`,
  ],
  invalid: [
    {
      code: `interface Loose {
        [key: string]: any;
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `type Loose = {
        [key: string]: unknown;
      };`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface Mixed {
        id: string;
        [key: string]: any;
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
  ],
});
