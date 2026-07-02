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
  ],
});
