import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overly-broad-generic-constraints.js";

ruleTester.run("no-overly-broad-generic-constraints", rule, {
  valid: [
    `interface Box<T extends { id: number }> {
      value: T;
    }`,
    `class IdBox implements Box<{ id: number; name: string }> {
      value: { id: number; name: string } = { id: 1, name: "test" };
    }`,
    `interface Container<T extends string> {
      item: T;
    }`,
    `function wrap<T>(value: T): T {
      return value;
    }`,
    `class Repository<T> {
      find(): T { throw new Error(); }
    }`,
    `interface Safe<T extends unknown> { get(): T; }`,
  ],
  invalid: [
    {
      code: `class AnyBox implements Box<any> {
        value: any = {};
      }`,
      errors: [{ messageId: "anyTypeArg" }],
    },
    {
      code: `interface Repo<T extends any> {
        get(): T;
      }`,
      errors: [{ messageId: "anyConstraint" }],
    },
    {
      code: `function unsafe<T extends any>(x: T) { return x; }`,
      errors: [{ messageId: "anyConstraint" }],
    },
    {
      code: `type Wrapper = Box<any>;`,
      errors: [{ messageId: "anyTypeArg" }],
    },
    {
      code: `class Multi implements Box<any>, List<any> {
        value: any = {};
      }`,
      errors: [{ messageId: "anyTypeArg" }, { messageId: "anyTypeArg" }],
    },
    {
      code: `const x: Box<List<any>> = null;`,
      errors: [{ messageId: "anyTypeArg" }, { messageId: "anyTypeArg" }],
    },
    {
      code: `type Wrapper = Box<any | string>;`,
      errors: [{ messageId: "anyTypeArg" }],
    },
    {
      code: `type Wrapper = Box<string & any>;`,
      errors: [{ messageId: "anyTypeArg" }],
    },
  ],
});
