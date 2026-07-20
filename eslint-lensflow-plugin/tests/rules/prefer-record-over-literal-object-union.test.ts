import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-record-over-literal-object-union.js";

ruleTester.run("prefer-record-over-literal-object-union", rule, {
  valid: [
    `type Fine = { env: "dev"; port: 3000 }`,
    `type Mixed = { env: "dev"; port: 3000 } | { env: string; port: 8080 }`,
    `type DifferentShape = { a: 1 } | { b: 2 }`,
    `type NonLiteralUnion = string | number`,
    `type SameLiterals = { env: "dev"; port: 3000 } | { env: "dev"; port: 3000 }`,
    `type PartialNonLiteral = { env: "dev"; port: 3000 } | { env: string; port: 8080 }`,
    `type MethodOnly = { env: "dev"; foo(): void } | { bar(): void; env: "prod" }`,
    `type CallSignature = { env: "dev"; (): void } | { env: "prod"; (): number }`,
    `type IndexSignature = { env: "dev"; [k: string]: number } | { env: "prod"; [k: string]: string }`,
  ],
  invalid: [
    {
      code: `type DiscriminatedLike = { env: "dev"; port: number } | { env: "prod"; port: number };`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type Config = { env: "dev"; port: 3000 } | { env: "prod"; port: 8080 };`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type Settings = { mode: "a"; value: 1 } | { mode: "b"; value: 2 } | { mode: "c"; value: 3 };`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type Options = { kind: "x"; count: 10 } | { kind: "y"; count: 20 };`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type QuotedKeys = { "env": "dev"; port: 3000 } | { "env": "prod"; port: 8080 };`,
      errors: [{ messageId: "preferRecord" }],
    },
    {
      code: `type BooleanValues = { flag: true; label: "a" } | { flag: false; label: "b" };`,
      errors: [{ messageId: "preferRecord" }],
    },
  ],
});
