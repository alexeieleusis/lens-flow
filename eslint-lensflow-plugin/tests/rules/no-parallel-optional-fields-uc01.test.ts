import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-parallel-optional-fields-uc01.js";

ruleTester.run("no-parallel-optional-fields-uc01", rule, {
  valid: [
    `interface User {
      id: string;
      name?: string;
    }`,
    `interface Config {
      host: string;
      port?: number;
      timeout?: number;
    }`,
    `type User =
      | { kind: "anonymized"; id: string }
      | { kind: "full"; id: string; name: string; email: string };`,
    `type State = {
      value: string;
      label?: string;
    };`,
  ],
  invalid: [
    {
      code: `interface User {
        id: string;
        name?: string;
        email?: string;
        age?: number;
      }`,
      errors: [{ messageId: "tooManyOptionalFields" }],
    },
    {
      code: `interface Product {
        id: string;
        title?: string;
        description?: string;
        price?: number;
      }`,
      errors: [{ messageId: "tooManyOptionalFields" }],
    },
    {
      code: `type Settings = {
        theme?: "light" | "dark";
        language?: string;
        fontSize?: number;
      };`,
      errors: [{ messageId: "tooManyOptionalFields" }],
    },
  ],
});
