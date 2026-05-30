import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-array-return.js";

ruleTester.run("no-any-array-return", rule, {
  valid: [
    `function map<A, B>(arr: A[], fn: (item: A) => B): B[] {
  return arr.map(fn);
}`,
    `function identity<T>(arr: T[]): T[] {
  return arr;
}`,
    `function getItems(): string[] {
  return [];
}`,
    `type Mapper = <A, B>(arr: A[], fn: (item: A) => B) => B[];`,
    `declare function transform<T>(arr: T[]): T[];`,
    `interface Processor {
  process<T>(items: T[]): T[];
}`,
  ],
  invalid: [
    {
      code: `function badMap<T>(arr: T[], fn: (item: any) => any): any[] {
  return arr.map(fn);
}`,
      errors: [{ messageId: "anyArrayReturn" }],
    },
    {
      code: `function getData(): any[] {
  return [];
}`,
      errors: [{ messageId: "anyArrayReturn" }],
    },
    {
      code: `type BadMapper = (arr: any[]) => any[];`,
      errors: [{ messageId: "anyArrayReturn" }],
    },
    {
      code: `interface BadProcessor {
  process(): any[];
}`,
      errors: [{ messageId: "anyArrayReturn" }],
    },
    {
      code: `declare function legacyTransform(): Array<any>;`,
      errors: [{ messageId: "anyArrayReturn" }],
    },
  ],
});
