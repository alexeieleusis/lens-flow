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
    `type StringArray = { [key: string]: string[] };`,
    `type StringArrayGeneric = { [key: string]: Array<string> };`,
    `type NestedSafe = { [key: string]: (string | number)[] };`,
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
    {
      code: `type AnyArray = { [key: string]: any[] };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type AnyArrayGeneric = { [key: string]: Array<any> };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type NestedAny = { [key: string]: (string | any)[] };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type DeepNested = { [key: string]: Array<any[]> };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type AnyIntersection = { [key: string]: any & { foo: string } };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type AnyTuple = { [key: string]: [any, string] };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type AnyWithNull = { [key: string]: null | any };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type RecordAnyValue = { [key: string]: Record<string, any> };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type NumberKeyAny = { [key: number]: any };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type NumberKeyAnyArray = { [key: number]: any[] };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type ParenthesizedAny = { [key: string]: (any) };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
    {
      code: `type ParenthesizedUnionAny = { [key: string]: (string | any) };`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
  ],
});
