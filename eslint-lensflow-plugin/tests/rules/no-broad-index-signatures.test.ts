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
    `interface UnionSafe {
      [key: string]: string | number | null;
    }`,
    `type UnionSafe = {
      [key: string]: string | number;
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
    {
      code: `interface UnionAny {
        [key: string]: string | any;
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface UnionUnknown {
        [key: string]: string | unknown;
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `type UnionAny = {
        [key: string]: number | null | any;
      };`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface ParenthesizedAny {
        [key: string]: (any);
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface ParenthesizedUnknown {
        [key: string]: (unknown);
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface UnionParenthesizedAny {
        [key: string]: string | (any);
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `interface NumberKeyAny {
        [key: number]: any;
      }`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
    {
      code: `type NumberKeyUnknown = {
        [key: number]: unknown;
      };`,
      errors: [{ messageId: "broadIndexSignature" }],
    },
  ],
});
