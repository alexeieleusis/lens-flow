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
    `type Handler = (data: string | boolean) => void;`,
    `type SafeCallback = (x: string | number | boolean) => void;`,
    `interface Service { handle(payload: string): void; }`,
    `class Service {
  handle(payload: string) { return payload; }
}`,
  ],
  invalid: [
    {
      code: `function process(data: any) {
  return data;
}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `const handle = (data: any) => data.toString();`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `type BadHandler = (data: any) => void;`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `interface Service { handle(payload: any): void; }`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `declare function legacyApi(input: any): string;`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `function process(...args: any) {}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
    {
      code: `class Service {
  handle(payload: any) { return payload; }
}`,
      errors: [{ messageId: "anyExternalParam" }],
    },
  ],
});
