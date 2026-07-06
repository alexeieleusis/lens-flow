import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-bypass.js";

ruleTester.run("no-as-any-bypass", rule, {
  valid: [
    `function parseEmail(raw: string): Email | null {
  return isValid(raw) ? (raw as Email) : null;
}`,
    `const value = x as string;`,
    `type Safe = unknown;`,
    `const value = x as unknown;`,
  ],
  invalid: [
    {
      code: `function parseEmail(raw: string): Email | null {
  return (raw as any) as Email;
}`,
      errors: [{ messageId: "doubleCastBypass" }],
    },
    {
      code: `const x = value as any;`,
      errors: [{ messageId: "anyCast" }],
    },
    {
      code: `function unsafe(val: unknown): MyBrand {
  return ((val as any) as any) as MyBrand;
}`,
      errors: [
        { messageId: "doubleCastBypass" },
        { messageId: "doubleCastBypass" },
      ],
    },
    {
      code: `obj.prop = value as any;`,
      errors: [{ messageId: "anyCast" }],
    },
    {
      code: `fn(value as any);`,
      errors: [{ messageId: "anyCast" }],
    },
    {
      code: `const obj = { x: value as any };`,
      errors: [{ messageId: "anyCast" }],
    },
    {
      code: `const arr = [value as any];`,
      errors: [{ messageId: "anyCast" }],
    },
  ],
});
