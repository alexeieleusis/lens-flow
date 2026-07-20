// eslint-plugin/tests/rules/no-abstract-class-without-concrete-methods.test.ts
import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-abstract-class-without-concrete-methods.js";

ruleTester.run("no-abstract-class-without-concrete-methods", rule, {
  valid: [
    `interface Service {
      call(): void;
    }`,
    `abstract class Service {
      abstract call(): void;
      log() { console.log("called"); }
    }`,
    `abstract class Service {
      abstract call(): void;
      protected baseUrl: string;
    }`,
    `abstract class Service {
      abstract call(): void;
      constructor() { this.baseUrl = "/"; }
    }`,
    `class Concrete {
      call() {}
    }`,
  ],
  invalid: [
    {
      code: `abstract class Service {
        abstract call(): void;
      }`,
      errors: [{ messageId: "noConcreteMethods" }],
    },
    {
      code: `abstract class Repository {
        abstract find(id: string): void;
        abstract save(item: object): void;
      }`,
      errors: [{ messageId: "noConcreteMethods" }],
    },
  ],
});
