import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-record-string-any.js";

ruleTester.run("no-record-string-any", rule, {
  valid: [
    `function processConfig(config: Record<string, unknown>) {
  const port = config.port;
  if (typeof port === "number") {
    port.toFixed();
  }
}`,
    `type Config = Record<string, string | number>`,
    `const data: Record<string, boolean> = {}`,
    `type MapType = Map<string, any>`,
    `type SafeArray = Record<string, any[]>`,
    `type SafeUnion = Record<string, any | null>`,
    `declare const x: Record<number, any>`,
  ],
  invalid: [
    {
      code: `function processConfig(config: Record<string, any>) {
  const port = config.port;
  port.toFixed();
}`,
      errors: [{ messageId: "recordAny" }],
    },
    {
      code: `type Config = Record<string, any>`,
      errors: [{ messageId: "recordAny" }],
    },
  ],
});
