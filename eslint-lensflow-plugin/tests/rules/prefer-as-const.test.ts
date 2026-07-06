import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-as-const.js";

ruleTester.run("prefer-as-const", rule, {
  valid: [
    `const COLORS = {
  primary: "red",
  secondary: "blue",
} as const;`,
    `const config = { a: 1, b: 2 };`,
    `const x = { a: "hi" } as Readonly<{ a: string }>;`,
    `const x = "hello" as string;`,
    // Method syntax — MethodSignature in type prevents rule from triggering
    `const x = { fn() {} } as { fn(): void };`,
    // Method with optional parameter
    `const x = { fn(x: number) { return x; } } as { fn(x?: number): number };`,
  ],
  invalid: [
    {
      code: `const COLORS = {
  primary: "red",
  secondary: "blue",
} as { readonly primary: string; readonly secondary: string };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const config = { a: 1, b: 2 } as { readonly a: number; readonly b: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const x = { a: { b: 1 } } as { readonly a: { readonly b: number } };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const a = 1; const x = { a } as { readonly a: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    {
      code: `const x = { ["key"]: 1 } as { readonly key: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    // Spread element
    {
      code: `const base = {}; const x = { ...base, a: 1 } as { readonly a: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    // Computed property with variable key
    {
      code: `const key = "a"; const x = { [key]: 1 } as { readonly a: number };`,
      errors: [{ messageId: "preferAsConst" }],
    },
    // Method syntax with property signature type
    {
      code: `const x = { fn() {} } as { readonly fn: () => void };`,
      errors: [{ messageId: "preferAsConst" }],
    },
  ],
});
