import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-parallel-boolean-state-flags.js";

ruleTester.run("no-parallel-boolean-state-flags", rule, {
  valid: [
    // Two boolean flags is below the default threshold of 3.
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    // Discriminated union pattern — no boolean flags at all.
    `type Payment =
      | { state: "empty" }
      | { state: "has_card"; card: Card }
      | { state: "processing" }
      | { state: "completed"; receipt: Receipt };`,
    // Mixed properties with only 2 booleans.
    `type State = {
      active: boolean;
      count: number;
      label: string;
      ready: boolean;
    }`,
    // Raising minCount to 4 allows 3 boolean flags to pass.
    {
      code: `type Config = {
        isEnabled: boolean;
        isDebug: boolean;
        isVerbose: boolean;
      }`,
      options: [{ minCount: 4 }],
    },
  ],
  invalid: [
    // From the antipattern snippet: 4 boolean properties in an interface.
    {
      code: `interface Payment {
        hasCard: boolean;
        hasToken: boolean;
        isProcessing: boolean;
        isCompleted: boolean;
      }`,
      errors: [{ messageId: "tooManyBooleanFlags" }],
    },
    // Type literal with 3 boolean properties.
    {
      code: `type Config = {
        isEnabled: boolean;
        isDebug: boolean;
        isVerbose: boolean;
      }`,
      errors: [{ messageId: "tooManyBooleanFlags" }],
    },
    // Quoted string property keys should be matched.
    {
      code: `type Config = {
        "a": boolean;
        "b": boolean;
        "c": boolean;
      }`,
      errors: [{ messageId: "tooManyBooleanFlags" }],
    },
    // Lowering minCount to 2 makes 2 boolean flags fail.
    {
      code: `interface Fine {
        isPending: boolean;
        isComplete: boolean;
      }`,
      options: [{ minCount: 2 }],
      errors: [{ messageId: "tooManyBooleanFlags" }],
    },
  ],
});
