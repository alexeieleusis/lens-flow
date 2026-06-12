import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-cast-chain.js";

ruleTester.run("no-any-cast-chain", rule, {
  valid: [
    `const proper = RequestBuilder.create().setUrl("url").setBody("body");`,
    `const value = someValue as SomeType;`,
    `const safe = (x as unknown) as SomeType;`,
  ],
  invalid: [
    {
      code: `const bypassed = someValue as any as RequestBuilder<WithBody>;`,
      errors: [{ messageId: "anyCastChain" }],
    },
    {
      code: `const x = (foo as any) as Bar;`,
      errors: [{ messageId: "anyCastChain" }],
    },
    {
      code: `const y = (a as string) as any as number;`,
      errors: [{ messageId: "anyCastChain" }, { messageId: "anyCastChain" }],
    },
  ],
});
