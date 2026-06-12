import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-interface.js";

ruleTester.run("no-any-in-interface", rule, {
  valid: [
    `interface Config {
      name: string;
      options: { theme: "light" | "dark"; debug: boolean };
    }`,
    `type Config = {
      name: string;
      value: number;
    }`,
    `interface Strict {
      data: unknown;
      label: string;
    }`,
    `type TypedRecord = Record<string, { id: number }>`,
  ],
  invalid: [
    {
      code: `interface Config {
        name: string;
        options: any;
      }`,
      errors: [{ messageId: "anyProperty" }],
    },
    {
      code: `interface Props {
        id: number;
        extra: any;
        meta: any;
      }`,
      errors: [
        { messageId: "anyProperty" },
        { messageId: "anyProperty" },
      ],
    },
    {
      code: `type Config = {
        name: string;
        raw: any;
      }`,
      errors: [{ messageId: "anyProperty" }],
    },
    {
      code: `interface Bucket {
        [key: string]: any;
      }`,
      errors: [{ messageId: "anyIndexSignature" }],
    },
  ],
});
