import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-structural-type-as-runtime-guard.js";

ruleTester.run("no-structural-type-as-runtime-guard", rule, {
  valid: [
    // Proper type guard with runtime checks
    `function isUser(v: unknown): v is { id: string; name: string } {
      return (
        typeof v === "object" &&
        v !== null &&
        typeof (v as Record<string, unknown>).id === "string" &&
        typeof (v as Record<string, unknown>).name === "string"
      );
    }`,
    // No unknown param, so rule does not apply
    `function parseUser(json: string): { id: string; name: string } {
      return JSON.parse(json) as any;
    }`,
    // unknown param but no as any in return
    `function safeParse(data: unknown): { id: string } | null {
      if (typeof data === "object" && data !== null) {
        return data as { id: string };
      }
      return null;
    }`,
    // Arrow function with proper guard
    `const check = (v: unknown): v is string => typeof v === "string";`,
  ],
  invalid: [
    // Basic function declaration with unknown → as any
    {
      code: `function parseUser(json: unknown): { id: string; name: string } {
        return json as any;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Arrow function with block body
    {
      code: `const parseConfig = (raw: unknown): { key: string } => {
        return raw as any;
      };`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Function expression
    {
      code: `const handler = function(data: unknown) {
        return data as any;
      };`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Nested as any inside a more complex return expression
    {
      code: `function wrapResult(payload: unknown): Result {
        return { data: payload as any } as Result;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Destructured parameter (ObjectPattern)
    {
      code: `function parseUser({ id }: unknown): { id: string; name: string } {
        return id as any;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Destructured parameter (ArrayPattern)
    {
      code: `function parsePair([a, b]: unknown[]): { a: string; b: string } {
        return [a, b] as any;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Rest parameter
    {
      code: `function parseArgs(...args: unknown[]): { items: string[] } {
        return args as any;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Default value parameter (AssignmentPattern)
    {
      code: `function parseWithDefault(v: unknown = {}): { key: string } {
        return v as any;
      }`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
    // Expression-bodied arrow function
    {
      code: `const parseUser = (v: unknown): { id: string } => v as any;`,
      errors: [{ messageId: "structuralAsAnyGuard" }],
    },
  ],
});
