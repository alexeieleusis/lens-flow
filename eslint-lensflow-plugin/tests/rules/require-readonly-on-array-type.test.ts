// eslint-plugin/tests/rules/require-readonly-on-array-type.test.ts
import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-readonly-on-array-type.js";

ruleTester.run("require-readonly-on-array-type", rule, {
  valid: [
    `interface Config {
      readonly allowedHosts: readonly string[];
    }`,
    `interface Config {
      allowedHosts: string[];
    }`,
    `interface Config {
      readonly items: ReadonlyArray<number>;
    }`,
    `type Config = {
      readonly values: readonly boolean[];
    }`,
    `interface Fine {
      isPending: boolean;
    }`,
  ],
  invalid: [
    {
      code: `interface Config {
        readonly allowedHosts: string[];
      }`,
      errors: [{ messageId: "mutableArrayOnReadonlyProp" }],
    },
    {
      code: `interface Config {
        readonly items: Array<number>;
      }`,
      errors: [{ messageId: "mutableArrayRefOnReadonlyProp" }],
    },
    {
      code: `type Config = {
        readonly flags: boolean[];
      }`,
      errors: [{ messageId: "mutableArrayOnReadonlyProp" }],
    },
    {
      code: `type Config = {
        readonly items: Array<string>;
      }`,
      errors: [{ messageId: "mutableArrayRefOnReadonlyProp" }],
    },
    {
      code: `interface Config {
        readonly "allowed-hosts": string[];
      }`,
      errors: [{ messageId: "mutableArrayOnReadonlyProp" }],
    },
  ],
});
