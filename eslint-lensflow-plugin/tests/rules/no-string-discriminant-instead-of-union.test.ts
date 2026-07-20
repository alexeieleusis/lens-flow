import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-string-discriminant-instead-of-union.js";

ruleTester.run("no-string-discriminant-instead-of-union", rule, {
  valid: [
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `type Shape =
      | { kind: "circle"; radius: number }
      | { kind: "rect"; width: number; height: number };`,
    `interface Single {
      kind: "a" | "b";
    }`,
    `interface NoUnion {
      kind: string;
      value: number;
    }`,
    `interface OnlyDiscriminant {
      kind: "a" | "b";
    }`,
    `interface Mixed {
      kind: string | number;
      value: number;
    }`,
    `type Single = { kind: "a" | "b"; }`,
    `type Event = { kind: string; data: unknown }`,
  ],
  invalid: [
    {
      code: `type Event = {
        kind: "click" | "hover";
        data: unknown;
      }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
    {
      code: `type Status = { kind: "A" | "B"; data: unknown }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
    {
      code: `interface Shape {
        kind: "circle" | "rect";
        radius?: number;
        width?: number;
        height?: number;
      }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
    {
      code: `interface Payment {
        status: "pending" | "completed" | "failed";
        amount: number;
        currency: string;
      }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
    {
      code: `interface Message {
        type: "text" | "image" | "video";
        payload: unknown;
        timestamp: number;
      }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
    {
      code: `interface QuotedKey {
        "kind": "a" | "b";
        value: number;
      }`,
      errors: [{ messageId: "stringDiscriminant" }],
    },
  ],
});
