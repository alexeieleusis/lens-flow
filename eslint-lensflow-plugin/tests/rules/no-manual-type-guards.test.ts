import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-manual-type-guards.js";

ruleTester.run("no-manual-type-guards", rule, {
  valid: [
    `const user = UserSchema.parse(raw);`,
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `function isUser(obj: unknown): obj is User {
      return obj !== null && typeof obj === "object";
    }`,
    `function isUser(obj: unknown): obj is User {
      return typeof obj === "object" && "id" in obj;
    }`,
    `function check(obj: unknown) {
      return typeof obj === "string";
    }`,
    {
      code: `function isUser(obj: unknown): obj is User {
        return obj !== null && typeof obj === "object" && "id" in obj && typeof obj.id === "string";
      }`,
      options: [{ minChecks: 5 }],
    },
    `function isUser(obj: unknown): obj is User {
      return UserSchema.safeParse(obj).success;
    }`,
    // Regression: nested function checks must NOT count toward outer guard.
    // Without function-boundary enforcement, the 4 typeof/in checks inside the
    // nested callback would combine with the outer 2 to reach the minChecks
    // threshold and produce a false positive.
    `function isUser(obj: unknown): obj is User {
      const validate = (x: unknown) => typeof x === "string" && "id" in x;
      return typeof obj === "object" && validate(obj);
    }`,
  ],
  invalid: [
    {
      code: `function isUser(obj: unknown): obj is User {
        return obj !== null &&
               typeof obj === "object" &&
               "id" in obj && typeof obj.id === "string" &&
               "email" in obj && typeof obj.email === "string";
      }`,
      errors: [{ messageId: "manualTypeGuard" }],
    },
    {
      code: `function isAdmin(obj: unknown): obj is Admin {
        return typeof obj === "object" &&
               obj !== null &&
               "role" in obj &&
               typeof obj.role === "string" &&
               "permissions" in obj;
      }`,
      errors: [{ messageId: "manualTypeGuard" }],
    },
    {
      code: `const isConfig = (obj: unknown): obj is Config => {
        return typeof obj === "object" &&
               obj !== null &&
               "name" in obj &&
               "version" in obj;
      }`,
      errors: [{ messageId: "manualTypeGuard" }],
    },
  ],
});
