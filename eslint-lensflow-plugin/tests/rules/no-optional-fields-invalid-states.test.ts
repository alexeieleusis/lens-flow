import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-optional-fields-invalid-states.js";

ruleTester.run("no-optional-fields-invalid-states", rule, {
  valid: [
    `interface Payment {
      amount: number;
      txId?: string;
    }`,
    `type Payment = {
      amount: number;
      txId?: string;
    };`,
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `type State = {
      kind: "pending";
    };`,
  ],
  invalid: [
    {
      code: `interface Payment {
        amount: number;
        txId?: string;
        refundAt?: Date;
      }`,
      errors: [{ messageId: "optionalFields" }],
    },
    {
      code: `type Payment = {
        amount: number;
        txId?: string;
        refundAt?: Date;
      };`,
      errors: [{ messageId: "optionalFields" }],
    },
  ],
});
