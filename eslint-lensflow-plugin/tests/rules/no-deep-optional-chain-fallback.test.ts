import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deep-optional-chain-fallback.js";

ruleTester.run("no-deep-optional-chain-fallback", rule, {
  valid: [
    `const x = user?.id ?? 0;`,
    `const name = user?.name ?? "Unknown";`,
    `const val = a.b.c;`,
    `const x = user?.profile?.id;`,
    `const x = user.id ?? 0;`,
  ],
  invalid: [
    {
      code: `const userId = user?.profile?.id ?? user.id ?? 0;`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const name = user?.profile?.name ?? "Unknown";`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const val = a?.b?.c?.d ?? null;`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const x = a?.b ?? c ?? d;`,
      errors: [{ messageId: "deepChain" }],
    },
  ],
});
