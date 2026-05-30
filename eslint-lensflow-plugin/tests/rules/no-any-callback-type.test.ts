import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-callback-type.js";

ruleTester.run("no-any-callback-type", rule, {
  valid: [
    // Explicit callable type preserves checking
    `type Handler = (event: MouseEvent) => void;`,
    // Non-rest parameter with any array
    `type Handler = (args: any[]) => any;`,
    // Rest parameter but typed, not any[]
    `type Handler = (...args: string[]) => void;`,
    // Rest any[] but typed return
    `type Handler = (...args: any[]) => string;`,
    // Two parameters
    `type Handler = (a: string, b: number) => any;`,
    // No parameters
    `type Handler = () => any;`,
    // Rest parameter with tuple
    `type Handler = (...args: [string, number]) => any;`,
  ],
  invalid: [
    {
      code: `type Handler = (...args: any[]) => any;`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    {
      code: `
        interface Callbacks {
          onEvent: (...args: any[]) => any;
        }
      `,
      errors: [{ messageId: "anyCallbackType" }],
    },
    {
      code: `type Fn = (...x: any[]) => any;`,
      errors: [{ messageId: "anyCallbackType" }],
    },
  ],
});
