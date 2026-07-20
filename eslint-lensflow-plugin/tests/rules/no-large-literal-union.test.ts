import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-large-literal-union.js";

ruleTester.run("no-large-literal-union", rule, {
  valid: [
    `type Status = "pending" | "complete" | "failed";`,
    `type SmallUnion = "a" | "b" | "c" | "d" | "e";`,
    `type Mixed = "GET" | "POST" | number;`,
    `const Methods = {
      GET: "GET", POST: "POST", PUT: "PUT", DELETE: "DELETE",
      PATCH: "PATCH", HEAD: "HEAD", OPTIONS: "OPTIONS",
    } as const;
    type CommonMethod = (typeof Methods)[keyof typeof Methods];`,
    {
      code: `type Code =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;`,
      options: [{ maxMembers: 20 }],
    },
  ],
  invalid: [
    {
      code: `type HTTPMethod =
  | "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  | "HEAD" | "OPTIONS" | "TRACE" | "CONNECT"
  | "PROPFIND" | "PROPPATCH" | "MKCOL" | "COPY"
  | "MOVE" | "LOCK" | "UNLOCK" | "SEARCH"
  | "NOTIFY" | "SUBSCRIBE" | "UNSUBSCRIBE" | "MKCALENDAR";`,
      options: [{ maxMembers: 20 }],
      errors: [{ messageId: "tooManyLiteralMembers" }],
    },
    {
      code: `type Code =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;`,
      options: [{ maxMembers: 19 }],
      errors: [{ messageId: "tooManyLiteralMembers" }],
    },
  ],
});
