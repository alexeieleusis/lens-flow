import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-interface-over-pure-abstract-class.js";

ruleTester.run("prefer-interface-over-pure-abstract-class", rule, {
  valid: [
    `interface Handler {
      handle(event: unknown): void;
    }`,
    `abstract class Handler {
      abstract handle(event: unknown): void;
      handle(event: unknown) {
        console.log(event);
      }
    }`,
    `abstract class Base {
      abstract doSomething(): void;
      state = 0;
    }`,
    `abstract class Base {
      abstract doSomething(): void;
      static {
        console.log("init");
      }
    }`,
    `class Concrete {
      doSomething() {}
    }`,
    `abstract class Base {
      static abstract create(): Base;
    }`,
  ],
  invalid: [
    {
      code: `abstract class Handler {
        abstract handle(event: unknown): void;
      }`,
      errors: [{ messageId: "preferInterface" }],
    },
    {
      code: `abstract class Service {
        abstract start(): void;
        abstract stop(): void;
        abstract reset(): void;
      }`,
      errors: [{ messageId: "preferInterface" }],
    },
  ],
});
