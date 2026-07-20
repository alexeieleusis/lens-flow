import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-god-interface.js";

ruleTester.run("no-god-interface", rule, {
  valid: [
    // Few optional properties, few total — no issue
    `interface Config {
      host: string;
      port: number;
    }`,
    // 4 optional (below default 5 threshold), small total
    `interface Settings {
      host: string;
      port: number;
      timeout?: number;
      retries?: number;
      logger?: Logger;
      cache?: Cache;
    }`,
    // 5 total but none optional — under both thresholds
    `interface NetworkConfig {
      host: string;
      port: number;
      timeout: number;
    }`,
    // Type literal: under thresholds
    `type Small = {
      host: string;
      port?: number;
      timeout?: number;
    };`,
    // Exactly at threshold minus one: 4 optional (maxOptional=5), 4 total (maxTotal=8)
    `interface JustBelow {
      a?: string;
      b?: number;
      c?: boolean;
      d?: string;
    }`,
    // 7 total (below default 8 maxTotalFields), no optional
    `interface JustBelowTotal {
      a: string;
      b: number;
      c: boolean;
      d: string;
      e: number;
      f: string;
      g: boolean;
    }`,
    // 5 optional but minOptionalFields raised to 10 — should not trigger
    {
      code: `interface CustomThreshold {
        a?: string;
        b?: number;
        c?: boolean;
        d?: string;
        e?: number;
      }`,
      options: [{ minOptionalFields: 10 }],
    },
    // 5 total with maxTotalFields: 8 (lowered from default still passes)
    {
      code: `interface WithinCustomTotal {
        a: string;
        b: number;
        c: boolean;
        d: string;
        e: number;
      }`,
      options: [{ maxTotalFields: 8 }],
    },
    // Exactly 5 optional (boundary, > 5 does NOT trigger), 5 total — verifies boundary behavior
    {
      code: `interface BoundaryOptional {
        a?: string;
        b?: number;
        c?: boolean;
        d?: string;
        e?: number;
      }`,
    },
  ],
  invalid: [
    // 6 optional properties (>= 5 default), also 6 total
    {
      code: `interface Config {
        host?: string;
        port?: number;
        timeout?: number;
        retries?: number;
        logger?: Logger;
        cache?: Cache;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    // 8 total properties, 0 optional — triggers total threshold
    {
      code: `interface Big {
        a: string;
        b: number;
        c: boolean;
        d: string;
        e: number;
        f: string;
        g: boolean;
        h: string;
      }`,
      errors: [{ messageId: "tooManyTotal" }],
    },
    // Type literal with many optional fields
    {
      code: `type Settings = {
        host?: string;
        port?: number;
        timeout?: number;
        retries?: number;
        logger?: Logger;
        cache?: Cache;
      };`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    // 9 total, 2 optional — triggers total threshold (>= 8)
    {
      code: `interface Large {
        a: string;
        b: number;
        c: boolean;
        d?: string;
        e: number;
        f: string;
        g: boolean;
        h?: number;
        i: string;
      }`,
      errors: [{ messageId: "tooManyTotal" }],
    },
    // 3 optional (below default 5) but minOptionalFields lowered to 2 — triggers
    {
      code: `interface CustomLowered {
        a?: string;
        b?: number;
        c?: boolean;
      }`,
      options: [{ minOptionalFields: 2 }],
      errors: [{ messageId: "tooManyOptional" }],
    },
    // 6 total (below default 8) but maxTotalFields lowered to 5 — triggers
    {
      code: `interface CustomTotalLowered {
        a: string;
        b: number;
        c: boolean;
        d: string;
        e: number;
        f: string;
      }`,
      options: [{ maxTotalFields: 5 }],
      errors: [{ messageId: "tooManyTotal" }],
    },
    // Anonymous inline type literal in function parameter — triggers, name renders as "anonymous"
    {
      code: `function config(opts: {
        host?: string;
        port?: number;
        timeout?: number;
        retries?: number;
        logger?: Logger;
        cache?: Cache;
      }) {}`,
      errors: [
        {
          messageId: "tooManyOptional",
        },
      ],
    },
  ],
});
