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
  ],
  invalid: [
    // Exactly 5 optional (boundary, >= 5 triggers), 5 total — verifies boundary behavior
    {
      code: `interface BoundaryOptional {
        a?: string;
        b?: number;
        c?: boolean;
        d?: string;
        e?: number;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
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
  ],
});
