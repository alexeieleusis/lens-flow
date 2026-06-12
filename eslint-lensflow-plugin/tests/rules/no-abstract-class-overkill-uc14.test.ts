import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-abstract-class-overkill-uc14.js";

ruleTester.run("no-abstract-class-overkill-uc14", rule, {
  valid: [
    // Interface is the correct form — should not trigger
    `interface SimpleHandler { handle(x: number): string }`,
    // Abstract class with 3 abstract methods exceeds default max of 2
    `abstract class BigHandler {
      abstract handle(x: number): string;
      abstract parse(y: string): boolean;
      abstract validate(z: boolean): void;
    }`,
    // Abstract class with shared behavior (concrete method) — should not trigger
    `abstract class HandlerWithImpl {
      abstract handle(x: number): string;
      log() { console.log("handling"); }
    }`,
    // Abstract class with instance fields — should not trigger
    `abstract class HandlerWithState {
      private id = 0;
      abstract handle(x: number): string;
    }`,
    // Regression pair: instance fields DO suppress the rule (unlike static fields above)
    `abstract class InstanceFieldSuppresses {
      private id = 0;
      abstract handle(x: number): string;
    }`,
    // Static-only fields don't count as instance state — combined with instance field, should not trigger
    `abstract class HandlerWithBothFields {
      static readonly KIND = "handler";
      private id = 0;
      abstract handle(x: number): string;
    }`,
    // Regular (non-abstract) class — should not trigger
    `class ConcreteHandler {
      handle(x: number): string { return String(x); }
    }`,
  ],
  invalid: [
    {
      code: `abstract class SimpleHandler {
  abstract handle(x: number): string;
}`,
      errors: [{ messageId: "abstractOverkill" }],
    },
    {
      code: `abstract class DualHandler {
  abstract handle(x: number): string;
  abstract parse(y: string): boolean;
}`,
      errors: [{ messageId: "abstractOverkill" }],
    },
    {
      code: `abstract class SingleMethod {
  abstract run(): void;
}`,
      errors: [{ messageId: "abstractOverkill" }],
    },
    {
      code: `abstract class WithOnlyStatic {
  static readonly KIND = "handler";
  abstract handle(x: number): string;
}`,
      errors: [{ messageId: "abstractOverkill" }],
    },
    // Regression: static fields must NOT suppress the rule — only instance fields do.
    {
      code: `abstract class StaticOnlyRegression {
  static counter = 0;
  static readonly TAG = "reg";
  abstract handle(x: number): string;
}`,
      errors: [{ messageId: "abstractOverkill" }],
    },
  ],
});
