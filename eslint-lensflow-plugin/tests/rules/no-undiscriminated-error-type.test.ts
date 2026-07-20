import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-undiscriminated-error-type.js";

ruleTester.run("no-undiscriminated-error-type", rule, {
  valid: [
    // Properly discriminated error union
    `type Error =
      | { kind: "NotFound"; message: string }
      | { kind: "Unauthorized"; message: string }
      | { kind: "Timeout"; message: string };`,
    // Interface with discriminant
    `interface AppError {
      kind: "validation";
      message: string;
    }`,
    // Type with two+ properties (not undiscriminated)
    `interface ResponseError {
      message: string;
      statusCode: number;
    }`,
    // Non-error named type with single message string is still fine if it has discriminant
    `interface Result {
      tag: "ok" | "err";
      message: string;
    }`,
    // Type with 'message' but not named like an error, and has other properties
    `interface Info {
      message: string;
      timestamp: number;
    }`,
    // Empty body is fine
    `interface Empty {}`,
    // Error type with discriminant and message (code is a union of literals = discriminant)
    `type Failure = {
      code: "E001" | "E002";
      message: string;
    };`,
    // Type alias with discriminant via union of literals
    `type AppFail = {
      kind: "a" | "b";
      details: string;
    };`,
  ],
  invalid: [
    // Classic case: only message: string
    {
      code: `type Error = { message: string };`,
      errors: [{ messageId: "singleMessageProperty" }],
    },
    // Interface with only message: string
    {
      code: `interface ApiError {
        message: string;
      }`,
      errors: [{ messageId: "singleMessageProperty" }],
    },
    // Type alias with only message: string
    {
      code: `type Fail = { message: string };`,
      errors: [{ messageId: "singleMessageProperty" }],
    },
    // Error type with only 'error' string property and error-like name
    {
      code: `interface Exception {
        error: string;
      }`,
      errors: [{ messageId: "undiscriminatedError" }],
    },
    // Type named Failure with single message string
    {
      code: `type Failure = { message: string };`,
      errors: [{ messageId: "singleMessageProperty" }],
    },
    // Error type with non-discriminant property (code: number is not literal)
    {
      code: `interface Error {
        code: number;
      }`,
      errors: [{ messageId: "undiscriminatedError" }],
    },
    // Non-string single property on error-named type (Case 3)
    {
      code: `interface Exception {
        details: number;
      }`,
      errors: [{ messageId: "undiscriminatedError" }],
    },
    // String-literal property key (quoted key)
    {
      code: `interface Error { "message": string; }`,
      errors: [{ messageId: "singleMessageProperty" }],
    },
  ],
});
