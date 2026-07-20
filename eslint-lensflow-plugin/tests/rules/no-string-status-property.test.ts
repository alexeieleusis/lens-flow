import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-string-status-property.js";

ruleTester.run("no-string-status-property", rule, {
  valid: [
    `interface ApiResponse {
  status: "OK" | "ERROR" | "PENDING";
}`,
    `type RequestState = {
  state: "idle" | "loading" | "done";
}`,
    `interface Config {
  mode: "dev" | "prod";
  name: string;
}`,
    `interface Fine {
  count: number;
  label: string;
}`,
    `interface WithTypeRef {
  status: Status;
}`,
    {
      code: `interface ApiResponse {
  status: string;
}`,
      options: [{ statusFieldNames: ["customStatus"] }],
    },
    {
      code: `interface Config {
  state: string;
  kind: string;
  mode: string;
}`,
      options: [{ statusFieldNames: ["customStatus"] }],
    },
  ],
  invalid: [
    {
      code: `interface ApiResponse {
  status: string;
}`,
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `type Handler = {
  state: string;
  name: string;
}`,
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `interface Pipeline {
  phase: string;
  step: string;
}`,
      errors: [
        { messageId: "stringStatusField" },
        { messageId: "stringStatusField" },
      ],
    },
    {
      code: `interface Node {
  kind: string;
}`,
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `interface Step {
  stage: string;
  level: string;
  mode: string;
}`,
      errors: [
        { messageId: "stringStatusField" },
        { messageId: "stringStatusField" },
        { messageId: "stringStatusField" },
      ],
    },
    {
      code: `interface Api {
  "status": string;
}`,
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `interface Api {
  Status: string;
}`,
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `interface Handler {
  customStatus: string;
  name: string;
}`,
      options: [{ statusFieldNames: ["customStatus"] }],
      errors: [{ messageId: "stringStatusField" }],
    },
    {
      code: `interface Pipeline {
  customStatus: string;
  status: string;
}`,
      options: [{ statusFieldNames: ["customStatus", "status"] }],
      errors: [
        { messageId: "stringStatusField" },
        { messageId: "stringStatusField" },
      ],
    },
  ],
});
