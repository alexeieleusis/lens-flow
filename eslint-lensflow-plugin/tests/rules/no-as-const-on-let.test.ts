import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-const-on-let.js";

ruleTester.run("no-as-const-on-let", rule, {
  valid: [
    `const apiKey = fetchKey() as const;`,
    `let apiKey: string = fetchKey();`,
    `let count = 0;`,
    `const config = { host: "localhost", port: 3000 } as const;`,
    `var x = 1 as const;`,
  ],
  invalid: [
    {
      code: `let apiKey = fetchKey() as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let apiKey = "new-key" as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let config = { host: "localhost", port: 3000 } as const;`,
      errors: [{ messageId: "asConstOnLet" }],
    },
    {
      code: `let a = 1 as const;
let b = 2 as const;`,
      errors: [{ messageId: "asConstOnLet" }, { messageId: "asConstOnLet" }],
    },
    {
      code: `let nested = { inner: "value" as const };`,
      errors: [{ messageId: "asConstOnLet" }],
    },
  ],
});
