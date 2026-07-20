import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-partial-record.js";

ruleTester.run("no-partial-record", rule, {
  valid: [
    `const handlers: Record<HttpMethod, Handler> = { GET: h, POST: h, PUT: h, DELETE: h };`,
    `type Handlers = Partial<SomeOtherType>;`,
    `type Mapped = Record<HttpMethod, Handler>;`,
  ],
  invalid: [
    {
      code: `const handlers: Partial<Record<HttpMethod, Handler>> = { GET: h };`,
      errors: [{ messageId: "noPartialRecord" }],
    },
    {
      code: `type Handlers = Partial<Record<string, number>>;`,
      errors: [{ messageId: "noPartialRecord" }],
    },
    {
      code: `type Handlers = Utils.Partial<Utils.Record<HttpMethod, Handler>>;`,
      errors: [{ messageId: "noPartialRecord" }],
    },
    {
      code: `type M = NS.Partial<NS.Record<string, boolean>>;`,
      errors: [{ messageId: "noPartialRecord" }],
    },
  ],
});
