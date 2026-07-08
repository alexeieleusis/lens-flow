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
