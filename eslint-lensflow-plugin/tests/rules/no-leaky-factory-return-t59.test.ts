import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-leaky-factory-return-t59.js";

ruleTester.run("no-leaky-factory-return-t59", rule, {
  valid: [
    // Returns exactly the interface properties
    `interface Box { value: number }
function createBox(n: number): Box {
  return { value: n };
}`,
    // Interface with string-literal keys
    `interface Config { "host": string; "port": number }
function makeConfig(): Config {
  return { host: "localhost", port: 3000 };
}`,
    // Returns with as cast — argument is TSAsExpression, not ObjectExpression
    `interface Box { value: number }
function createBox(n: number): Box {
  return { value: n } as Box;
}`,
    // Arrow function expression body matching interface exactly
    `interface Box { value: number }
const createBox = (n: number): Box => ({ value: n });`,
    // Function without interface return type — not checked
    `function createBox(n: number) {
  return { value: n, extra: true };
}`,
    // Return type is not an interface reference (primitive)
    `function getValue(): number {
  return { value: 1, extra: true } as any;
}`,
    // Interface not found in file — skip
    `function createBox(n: number): UnknownIface {
  return { value: n, extra: true };
}`,
  ],
  invalid: [
    // Basic case: extra property in return object
    {
      code: `interface Box { value: number }
function createBox(n: number): Box {
  return { value: n, internalCache: new Map() };
}`,
      errors: [{ messageId: "leakyReturn" }],
    },
    // Multiple extra properties
    {
      code: `interface Config { name: string; port: number }
function makeConfig(): Config {
  return { name: "test", port: 8080, debug: true, verbose: false };
}`,
      errors: [{ messageId: "leakyReturn" }],
    },
    // Arrow function with block body
    {
      code: `interface Point { x: number; y: number }
const makePoint = (): Point => {
  return { x: 0, y: 0, label: "origin" };
}`,
      errors: [{ messageId: "leakyReturn" }],
    },
    // Function expression
    {
      code: `interface User { id: number; name: string }
const factory = function (): User {
  return { id: 1, name: "Alice", password: "secret" };
}`,
      errors: [{ messageId: "leakyReturn" }],
    },
  ],
});
