import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-literal-state-type.js";

ruleTester.run("require-literal-state-type", rule, {
  valid: [
    `interface Workflow {
      state: "draft" | "review" | "approved" | "published";
    }`,
    `type Item = {
      status: "active" | "archived";
    }`,
    `interface Fine {
      isPending: boolean;
      isComplete: boolean;
    }`,
    `interface Config {
      state: SomeType;
    }`,
    `type Data = {
      status: string | null;
    }`,
    `interface OK {
      name: string;
      value: string;
    }`,
    `type S = { "status": "a" | "b"; }`,
    `interface Quoted {
      "state": "open" | "closed";
    }`,
  ],
  invalid: [
    {
      code: `interface Workflow {
        state: string;
      }`,
      errors: [{ messageId: "bareStringState" }],
    },
    {
      code: `type Entity = {
        status: string;
      }`,
      errors: [{ messageId: "bareStringState" }],
    },
    {
      code: `interface Payment {
        id: number;
        state: string;
        amount: number;
      }`,
      errors: [{ messageId: "bareStringState" }],
    },
    {
      code: `type Request = {
        url: string;
        status: string;
        method: string;
      }`,
      errors: [{ messageId: "bareStringState" }],
    },
    {
      code: `interface Workflow {
        state: string;
      }
      function approve(w: Workflow) {
        if (w.state !== "draft") return { error: "Can only approve drafts" };
      }`,
      errors: [{ messageId: "bareStringState" }],
    },
    {
      code: `interface S { "state": string; }`,
      errors: [{ messageId: "bareStringState" }],
    },
  ],
});
