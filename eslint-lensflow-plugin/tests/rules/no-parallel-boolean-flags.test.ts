import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-parallel-boolean-flags.js";

ruleTester.run("no-parallel-boolean-flags", rule, {
  valid: [
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `type State =
      | { kind: "pending" }
      | { kind: "complete" };`,
    `type Config = {
      isReady: boolean;
      count: number;
    }`,
    `interface Mixed {
      isOn: boolean;
      label: string;
      isOff: boolean;
    }`,
  ],
  invalid: [
    {
      code: `interface Payment {
        isPending: boolean;
        isCompleted: boolean;
        isFailed: boolean;
        transactionId?: string;
        reason?: string;
      }`,
      errors: [{ messageId: "tooManyFlags" }],
    },
    {
      code: `type Config = {
        isEnabled: boolean;
        isDebug: boolean;
        isVerbose: boolean;
      }`,
      errors: [{ messageId: "tooManyFlags" }],
    },
    {
      code: `interface Status {
        isLoaded: boolean;
        isError: boolean;
        isEmpty: boolean;
        isDirty: boolean;
      }`,
      errors: [{ messageId: "tooManyFlags" }],
    },
  ],
});
