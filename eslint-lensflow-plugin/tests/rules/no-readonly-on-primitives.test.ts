import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-readonly-on-primitives.js";

ruleTester.run("no-readonly-on-primitives", rule, {
  valid: [
    `interface User {
      id: string;
      name: string;
    }`,
    `interface Config {
      readonly settings: Record<string, unknown>;
      readonly items: string[];
    }`,
    `class MyClass {
      count: number;
      label: string;
    }`,
    `type BrandedString = string & { __brand: "id" };
interface Doc {
  readonly id: BrandedString;
}`,
    `interface Data {
  readonly value: Date;
}`,
    `interface Config {
      readonly key: "foo" | "bar";
    }`,
  ],
  invalid: [
    {
      code: `interface User {
        readonly id: string;
        readonly name: string;
      }`,
      output: `interface User {
        id: string;
        name: string;
      }`,
      errors: [
        { messageId: "redundantReadonly" },
        { messageId: "redundantReadonly" },
      ],
    },
    {
      code: `interface Flags {
        readonly enabled: boolean;
        readonly count: number;
        readonly size: bigint;
        readonly tag: symbol;
      }`,
      output: `interface Flags {
        enabled: boolean;
        count: number;
        size: bigint;
        tag: symbol;
      }`,
      errors: [
        { messageId: "redundantReadonly" },
        { messageId: "redundantReadonly" },
        { messageId: "redundantReadonly" },
        { messageId: "redundantReadonly" },
      ],
    },
    {
      code: `class Settings {
        readonly title: string = "hello";
        readonly level: number = 42;
      }`,
      output: `class Settings {
        title: string = "hello";
        level: number = 42;
      }`,
      errors: [
        { messageId: "redundantReadonly" },
        { messageId: "redundantReadonly" },
      ],
    },
  ],
});
