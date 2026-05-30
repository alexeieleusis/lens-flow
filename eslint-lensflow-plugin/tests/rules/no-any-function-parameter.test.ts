import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-function-parameter.js";

ruleTester.run("no-any-function-parameter", rule, {
  valid: [
    `interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
}
function handleRequest(req: Request) {
  console.log(req.method, req.url);
}`,
    `const fn = (x: string) => x.length;`,
    `function add(a: number, b: number) {
  return a + b;
}`,
    `type Handler = (req: { method: string }) => void;
const h: Handler = (req) => {};`,
  ],
  invalid: [
    {
      code: `function handleRequest(req: any) {
  console.log(req.method, req.url);
}`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const handler = (req: any) => {
  console.log(req.method, req.url);
};`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function process(a: any, b: string) {
  return b;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `class Service {
  constructor(public dep: any) {}
}`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
