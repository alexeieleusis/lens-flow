import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-function-property-over-method.js";

ruleTester.run("prefer-function-property-over-method", rule, {
  valid: [
    `interface ContravariantBox<T> {
      fn: (arg: T) => void;
    }`,
    `interface NonGeneric {
      method(arg: string): void;
    }`,
    `interface NonGeneric<T> {
      method(arg: string): void;
    }`,
    `interface GenericNoUsage<T> {
      value: T;
    }`,
    `interface GenericWithNonRefMethod<T> {
      method(arg: number): void;
    }`,
  ],
  invalid: [
    {
      code: `interface BivariantBox<T> {
        method(arg: T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Handler<T, U> {
        handle(input: T, output: U): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Processor<T> {
        process(item: Array<T>): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Transformer<T> {
        transform(value: T | null): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Foo<T> {
        "process"(item: T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
  ],
});
