import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-duplicated-constraint-literal.js";

ruleTester.run("no-duplicated-constraint-literal", rule, {
  valid: [
    `type HasId = { id: string };
type PickId<T> = T extends HasId ? T["id"] : never;
type LogId<T>  = T extends HasId ? T["id"] : never;
type SaveId<T> = T extends HasId ? T["id"] : never;`,
    `type PickId<T> = T extends { id: string } ? T["id"] : never;`,
    `type A<T> = T extends { id: string } ? T["id"] : never;
type B<T> = T extends { name: string } ? T["name"] : never;`,
    `type A = { id: string } extends { id: string } ? true : false;`,
    // TSParenthesizedType wrapper — should still work
    `type A<T> = T extends ({ id: string }) ? T["id"] : never;`,
    // Different modifiers — should NOT be treated as duplicates
    `type A<T> = T extends { id?: string } ? T : never;
type B<T> = T extends { id: string } ? T : never;`,
  ],
  invalid: [
    {
      code: `type PickId<T> = T extends { id: string } ? T["id"] : never;
type LogId<T>  = T extends { id: string } ? T["id"] : never;
type SaveId<T> = T extends { id: string } ? T["id"] : never;`,
      errors: [
        { messageId: "duplicatedConstraint" },
        { messageId: "duplicatedConstraint" },
        { messageId: "duplicatedConstraint" },
      ],
    },
    {
      code: `type A<T> = T extends { x: number; y: number } ? T["x"] : never;
type B<T> = T extends { y: number; x: number } ? T["y"] : never;`,
      errors: [
        { messageId: "duplicatedConstraint" },
        { messageId: "duplicatedConstraint" },
      ],
    },
    {
      code: `type One<T> = T extends { a: string } ? T["a"] : never;
type Two<T> = T extends { a: string } ? T["a"] : never;`,
      errors: [
        { messageId: "duplicatedConstraint" },
        { messageId: "duplicatedConstraint" },
      ],
    },
  ],
});
