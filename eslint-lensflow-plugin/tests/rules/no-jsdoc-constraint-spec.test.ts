import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-jsdoc-constraint-spec.js";

ruleTester.run("no-jsdoc-constraint-spec", rule, {
  valid: [
    `type Request =
      | { method: "GET"; body?: never }
      | { method: "POST"; body: unknown }
      | { method: "PUT"; body: unknown }
      | { method: "DELETE"; body?: never };`,
    `interface Config {
      host: string;
      port: number;
    }`,
    `/** The name of the user */
    interface User {
      name: string;
    }`,
    `type State = {
      status: "pending" | "complete" | "failed";
    }`,
    `type Response = {
      /** The HTTP status code of the response */
      code: number;
    }`,
    // Regression: constraint comment on literal type union should NOT fire — the constraint is already encoded in the type
    `interface Request {
      // method must be "GET" | "POST"
      method: "GET" | "POST";
    }`,
    // Edge case: multiple separate comment lines should not produce false matches
    `interface User {
      // User profile identifier
      // Used for API routing
      userId: string;
    }`,
    // Edge case: empty comment should not crash or produce a false positive
    `interface Config {
      //
      host: string;
    }`,
    `interface Config {
      /**/
      host: string;
    }`,
  ],
  invalid: [
    {
      code: `interface Request {
  // @method must be "GET"|"POST"|"PUT"|"DELETE"
  method: string;
}`,
      errors: [{ messageId: "jsdocConstraint" }],
    },
    {
      code: `interface Request {
  // @body required when method is "POST"
  body: string;
}`,
      errors: [{ messageId: "jsdocConditionalField" }],
    },
    {
      code: `interface Account {
  /** status must be one of "active" | "inactive" */
  status: string;
}`,
      errors: [{ messageId: "jsdocConstraint" }],
    },
    {
      code: `type Response = {
  // code must be "OK"|"ERR"|"WARN"
  code: string;
}`,
      errors: [{ messageId: "jsdocConstraint" }],
    },
    {
      code: `interface Config {
  // port must be one of 80 | 443 | 8080
  port: number;
}`,
      errors: [{ messageId: "jsdocConstraint" }],
    },
    // Edge case: multi-line block JSDoc with constraint across lines should still be detected
    {
      code: `interface Account {
  /**
   * status must
   * be one of "active" | "inactive"
   */
  status: string;
}`,
      errors: [{ messageId: "jsdocConstraint" }],
    },
  ],
});
