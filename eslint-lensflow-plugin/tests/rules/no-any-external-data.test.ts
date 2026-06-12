import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-external-data.js";

ruleTester.run("no-any-external-data", rule, {
  valid: [
    `function process(x: string | number | boolean) {
  if (typeof x === "string") {
    x.toUpperCase();
  }
}`,
    `const handle = (data: string | number) => {
  if (typeof data === "string") {
    return data.length;
  }
  return data;
};`,
    `function parse(input: string) {
  return JSON.parse(input);
}`,
    `type Handler = (data: string | boolean) => void;
const h: Handler = (data) => {};`,
  ],
  invalid: [
    {
      code: `function process(x: any) {
  if (typeof x === "string") {
    x.toUpperCase();
  }
}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `const handler = (data: any) => {
  if (typeof data === "number") {
    return data.toFixed(2);
  }
};`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `function handle(a: any, b: string) {
  return b;
}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `class Service {
  constructor(public payload: any) {}
}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
  ],
});
