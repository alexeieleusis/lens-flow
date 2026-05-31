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
  ],
});
