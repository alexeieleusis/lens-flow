import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-boundary.js";

ruleTester.run("no-any-boundary", rule, {
  valid: [
    `const api: unknown = await fetch("/api").then(r => r.json());`,
    `type State =
      | { kind: "pending" }
      | { kind: "complete" };`,
    `const data = JSON.parse(input);`,
    `function process(value: unknown): string { return String(value); }`,
    `const result = fetchData() as ApiResponse;`,
    `const items: string[] = ["a", "b"];`,
  ],
  invalid: [
    {
      code: `const api = fetch("/api").then(r => r.json()) as any;`,
      errors: [{ messageId: "anyInAsExpression" }],
    },
    {
      code: `const data: any = JSON.parse(input);`,
      errors: [{ messageId: "anyInVarAnnotation" }],
    },
    {
      code: `function handleExternal(data: any) { return data; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `function parseResponse(): any { return result; }`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const handler = (payload: any) => payload.value;`,
      errors: [{ messageId: "anyInFunctionType" }],
    },
    {
      code: `const x: any = someValue as any;`,
      errors: [
        { messageId: "anyInVarAnnotation" },
        { messageId: "anyInAsExpression" },
      ],
    },
  ],
});
