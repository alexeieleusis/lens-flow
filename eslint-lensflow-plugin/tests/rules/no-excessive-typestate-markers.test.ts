import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-excessive-typestate-markers.js";

ruleTester.run("no-excessive-typestate-markers", rule, {
  valid: [
    // Only 3 markers — below the default threshold of 4
    `type WithHost = HasState<"WithHost">;
type WithPort = HasState<"WithPort">;
type WithDbName = HasState<"WithDbName">;`,
    // Regular config interface — no typestate markers at all
    `interface DbConfig {
  host?: string;
  port?: number;
  dbName?: string;
  poolSize?: number;
}
const defaults = { host: "localhost", port: 5432 };
function mergeDb(overrides: Partial<DbConfig>) {
  return { ...defaults, ...overrides };
}`,
    // Non-matching type names (lowercase after prefix)
    `type Withhost = HasState<"Withhost">;
type Withport = HasState<"Withport">;
type Withdbname = HasState<"Withdbname">;
type Withpool = HasState<"Withpool">;`,
    // Custom threshold — 4 markers but maxMarkers set to 5
    {
      code: `type WithHost = HasState<"WithHost">;
type WithPort = HasState<"WithPort">;
type WithDbName = HasState<"WithDbName">;
type WithPool = HasState<"WithPool">;`,
      options: [{ maxMarkers: 5 }],
    },
  ],
  invalid: [
    // 4 phantom state types matching /^With[A-Z]/
    {
      code: `type WithHost = HasState<"WithHost">;
type WithPort = HasState<"WithPort">;
type WithDbName = HasState<"WithDbName">;
type WithPool = HasState<"WithPool">;`,
      errors: [{ messageId: "excessiveMarkers" }],
    },
    // Mix of With* and No* markers
    {
      code: `type WithHost = HasState<"WithHost">;
type NoPort = HasState<"NoPort">;
type WithDbName = HasState<"WithDbName">;
type NoPool = HasState<"NoPool">;`,
      errors: [{ messageId: "excessiveMarkers" }],
    },
    // 5 markers — well above threshold
    {
      code: `type WithHost = HasState<"WithHost">;
type WithPort = HasState<"WithPort">;
type WithDbName = HasState<"WithDbName">;
type WithPool = HasState<"WithPool">;
type WithTimeout = HasState<"WithTimeout">;`,
      errors: [{ messageId: "excessiveMarkers" }],
    },
  ],
});
