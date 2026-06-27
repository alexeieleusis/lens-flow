import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-domain-parameter-uc02.js";

ruleTester.run("no-any-domain-parameter-uc02", rule, {
  valid: [
    `type Item = { price: number; quantity: number };
function processItem(item: Item) {
  return item.price * item.quantity;
}`,
    `type Item = { price: number; quantity: number };
function processItems(items: Item[]) {
  return items.map((i) => i.price * i.quantity);
}`,
    `function add(a: number, b: number) {
  return a + b;
}`,
    `const fn = (x: string): void => {
  console.log(x);
};`,
    `function handle(data: unknown) {
  if (typeof data === "string") return data;
  return null;
}`,
    // AssignmentPattern with non-any default
    `function greet(name: string = "world") {
  console.log(name);
}`,
    // RestElement with non-any type
    `function sum(...nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}`,
    // TSParameterProperty with non-any type
    `class Service {
  constructor(private readonly name: string) {}
}`,
    // Destructured param with non-any type
    `type Config = { host: string; port: number };
function connect({ host, port }: Config) {
  return host + ":" + port;
}`,
    // Destructured with default
    `function opts({ dryRun = false }: { dryRun: boolean }) {
  return dryRun;
}`,
    // RestElement with destructured pattern
    `function log(...entries: string[]) {
  entries.forEach(console.log);
}`,
  ],
  invalid: [
    {
      code: `function processItem(item: any) {
  return item.price * item.quantity;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `const process = (data: any) => {
  return data.value;
};`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function processItems(items: any[]) {
  return items.map((i) => i.price);
}`,
      errors: [{ messageId: "anyArrayParam" }],
    },
    {
      code: `const handler = function (payload: any) {
  return payload.id;
};`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function processItems(items: Array<any>) {
  return items.map((i) => i.price);
}`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `function processItems(items: ReadonlyArray<any>) {
  return items.map((i) => i.price);
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // AssignmentPattern with any
    {
      code: `function greet(name: any = "world") {
  console.log(name);
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // RestElement with any
    {
      code: `function log(...args: any) {
  args.forEach(console.log);
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // RestElement with any[]
    {
      code: `function log(...args: any[]) {
  args.forEach(console.log);
}`,
      errors: [{ messageId: "anyArrayParam" }],
    },
    // TSParameterProperty with any
    {
      code: `class Service {
  constructor(private readonly config: any) {}
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Destructured param with any
    {
      code: `function connect({ host, port }: any) {
  return host + ":" + port;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Destructured with default and any
    {
      code: `function opts({ dryRun = false }: any) {
  return dryRun;
}`,
      errors: [{ messageId: "anyParam" }],
    },
    // Arrow function with destructured any[]
    {
      code: `const fn = (items: any[]) => items.length;`,
      errors: [{ messageId: "anyArrayParam" }],
    },
  ],
});
