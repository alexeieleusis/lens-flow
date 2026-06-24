import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deeply-nested-union-members.js";

ruleTester.run("no-deeply-nested-union-members", rule, {
  valid: [
    `type Flat = { a: string } | { d: number };`,
    `type Shallow = { a: string } | { d: { e: number } };`,
    `type TwoLevels = { a: { b: string } } | { d: { e: number } };`,
    `type Mixed = string | number | { a: { b: string } };`,
    `type Optional = { a: { b?: string } } | { d: number };`,
    `type WithArray = { items: string[] } | { count: number };`,
  ],
  invalid: [
    {
      code: `type Deep = { a: { b: { c: string } } } | { d: { e: number } };`,
      errors: [{ messageId: "deepNesting" }],
    },
    {
      code: `type VeryDeep = { x: { y: { z: { w: string } } } } | { a: number };`,
      errors: [{ messageId: "deepNesting" }],
    },
    {
      code: `type Config = { db: { conn: { pool: { size: number } } } } | { cache: boolean };`,
      errors: [{ messageId: "deepNesting" }],
    },
    {
       code: `type NestedUnion = { a: { b: { c: string } } } | { d: { e: { f: number } } };`,
       errors: [
         { messageId: "deepNesting" },
         { messageId: "deepNesting" },
       ],
     },
  ],
});
