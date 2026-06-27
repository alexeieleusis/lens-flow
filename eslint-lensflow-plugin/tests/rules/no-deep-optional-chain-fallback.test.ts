import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deep-optional-chain-fallback.js";

ruleTester.run("no-deep-optional-chain-fallback", rule, {
  valid: [
    `const x = user?.id ?? 0;`,
    `const name = user?.name ?? "Unknown";`,
    `const val = a.b.c;`,
    `const x = user?.profile?.id;`,
    `const x = user.id ?? 0;`,
    {
      code: `const name = user?.profile?.name ?? "Unknown";`,
      options: [{ minDepth: 3 }],
    },
    // --- Boundary: depth exactly minDepth - 1 should be valid ---
    {
      code: `const x = a?.b ?? 0;`,
      options: [{ minDepth: 2 }],
    },
    // --- TypeScript type annotation cases ---
    `const x: number = user?.id ?? 0;`,
    `const x: number | undefined = user?.profile?.id;`,
    `const name: string = user?.name ?? "Unknown";`,
    {
      code: `const name: string = user?.profile?.name ?? "Unknown";`,
      options: [{ minDepth: 3 }],
    },
    // --- Inferred type cases ---
    `const x = (user as User)?.id ?? 0;`,
    `const x = (user as User)?.profile?.id;`,
  ],
  invalid: [
    // --- Triggers on chain depth (depth >= minDepth) ---
    {
      code: `const x = user?.id ?? 0;`,
      options: [{ minDepth: 1 }],
      errors: [{ messageId: "deepChain" }],
    },
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
    // --- Triggers on fallback count (fallbackCount >= 2), NOT chain depth ---
    {
      code: `const x = a?.b ?? c ?? d;`,
      errors: [{ messageId: "deepChain" }],
    },
    // --- TypeScript type annotation invalid cases ---
    {
      code: `const userId: number = user?.profile?.id ?? user.id ?? 0;`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const val: string | null = a?.b?.c?.d ?? null;`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const name: string = user?.profile?.name ?? "Unknown";`,
      errors: [{ messageId: "deepChain" }],
    },
    // --- Inferred type invalid cases ---
    {
      code: `const userId = (user as User)?.profile?.id ?? (user as User).id ?? 0;`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `const val: string | null = (obj as Record<string, any>)?.a?.b?.c ?? null;`,
      errors: [{ messageId: "deepChain" }],
    },
  ],
});
