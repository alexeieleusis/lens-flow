import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-smart-constructor-validation.js";

ruleTester.run("require-smart-constructor-validation", rule, {
  valid: [
    // Valid: smart constructor with range validation
    `type Port = number & { __brand: "Port" };
function mkPort(n: number): Port | null {
  return n > 0 && n < 65536 ? (n as Port) : null;
}`,
    // Valid: smart constructor with if-guard
    `type UserId = string & { __brand: "UserId" };
function mkUserId(s: string): UserId | null {
  if (s.length < 3 || s.length > 100) return null;
  return s as UserId;
}`,
    // Valid: arrow function with validation
    `type Host = string & { __brand: "Host" };
const mkHost = (h: string): Host | null =>
  h.trim().length > 0 ? (h as Host) : null;`,
    // Valid: no branded cast — should not trigger
    `function add(a: number, b: number): number {
  return a + b;
}`,
    // Valid: function with validation via comparison
    `type Age = number & { __brand: "Age" };
function makeAge(n: number): Age | null {
  if (n <= 0 || n >= 200) return null;
  return n as Age;
}`,
    // Valid: callExpression-based validation
    `type Email = string & { __brand: "Email" };
function mkEmail(s: string): Email | null {
  if (!s.includes("@")) return null;
  return s as Email;
}`,
  ],
  invalid: [
    // Invalid: bare cast to branded type, no validation
    {
      code: `type Port = number & { __brand: "Port" };
function mkPort(n: number): Port {
  return n as Port;
}`,
      errors: [{ messageId: "noValidation" }],
    },
    // Invalid: arrow function bare cast
    {
      code: `type UserId = string & { __brand: "UserId" };
const mkUserId = (s: string): UserId => s as UserId;`,
      errors: [{ messageId: "noValidation" }],
    },
    // Invalid: function expression with no validation
    {
      code: `type Token = string & { __brand: "Token" };
const fn = function(t: string): Token {
  return t as Token;
}`,
      errors: [{ messageId: "noValidation" }],
    },
    // Invalid: cast to branded type in body, no return type annotation but cast exists
    {
      code: `type Host = string & { __brand: "Host" };
function mkHost(h: string): Host {
  return h as Host;
}`,
      errors: [{ messageId: "noValidation" }],
    },
    // Invalid: multi-statement body with bare cast, no validation
    {
      code: `type Port = number & { __brand: "Port" };
function mkPort(n: number): Port {
  const v = n;
  return v as Port;
}`,
      errors: [{ messageId: "noValidation" }],
    },
    // Invalid: call expression wraps a branded cast without actual validation
    {
      code: `type Email = string & { __brand: "Email" };
function mkEmail(s: string): Email {
  return isValidEmail(s as Email);
}`,
      errors: [{ messageId: "noValidation" }],
    },
  ],
});
