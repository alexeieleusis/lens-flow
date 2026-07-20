import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-noop-brand-constructor.js";

ruleTester.run("no-noop-brand-constructor", rule, {
  valid: [
    // Branded return type with throw validation — not a noop
    `function makePositive(
  n: number,
): number & { readonly __brand: "PositiveNumber" } {
  if (n <= 0) throw new Error("must be positive");
  return n as (number & { readonly __brand: "PositiveNumber" });
}`,
    // Branded return type with if + call expression validation
    `function parseEmail(
  raw: string,
): string & { readonly __brand: "Email" } {
  if (!raw.includes("@")) throw new Error("invalid");
  return raw as (string & { readonly __brand: "Email" });
}`,
    // Arrow function with validation body
    `const parseUserId = (
  raw: string,
): string & { readonly __brand: "UserId" } => {
  if (!raw) throw new Error("empty");
  return raw as (string & { readonly __brand: "UserId" });
};`,
    // Non-branded return type — plain number
    `function double(n: number): number {
  return n * 2;
}`,
    // Branded return type but body does more than just cast
    `function makePositive(
  n: number,
): number & { readonly __brand: "PositiveNumber" } {
  const validated = Math.abs(n);
  return validated as (number & { readonly __brand: "PositiveNumber" });
}`,
    // Branded return type but returns a method call, not a direct param cast
    `function parseEmail(
  raw: string,
): string & { readonly __brand: "Email" } {
  return raw.trim() as (string & { readonly __brand: "Email" });
}`,
    // Function with destructured params (no plain Identifier params)
    `function makeConfig(
  { value }: { value: number },
): number & { readonly __brand: "Config" } {
  return value as (number & { readonly __brand: "Config" });
}`,
    // Non-brand structural intersection — should NOT be flagged as branded type
    `function makeTracked(
  n: number,
): number & { readonly count: number } {
  return n as (number & { readonly count: number });
}`,
  ],
  invalid: [
    // Noop constructor — function declaration with inline branded type
    {
      code: `function makeAnyNumber(
  n: number,
): number & { readonly __anyNumberBrand: true } {
  return n as (number & { readonly __anyNumberBrand: true });
}`,
      errors: [{ messageId: "noopBrandConstructor" }],
    },
    // Noop constructor — concise arrow function with inline branded type
    {
      code: `const makeBranded = (
  s: string,
): string & { readonly __brand: "BrandedStr" } =>
  s as (string & { readonly __brand: "BrandedStr" });`,
      errors: [{ messageId: "noopBrandConstructor" }],
    },
    // Noop constructor — function expression with inline branded type
    {
      code: `const fn = function makeToken(
  raw: string,
): string & { readonly __brand: "Token" } {
  return raw as (string & { readonly __brand: "Token" });
};`,
      errors: [{ messageId: "noopBrandConstructor" }],
    },
    // Noop constructor — default parameter (AssignmentPattern)
    {
      code: `const makeB = (
  n: number = 0,
): number & { readonly __brand: "B" } =>
  n as (number & { readonly __brand: "B" });`,
      errors: [{ messageId: "noopBrandConstructor" }],
    },
  ],
});
