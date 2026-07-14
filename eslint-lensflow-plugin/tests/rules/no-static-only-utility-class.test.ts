import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-static-only-utility-class.js";

ruleTester.run("no-static-only-utility-class", rule, {
  valid: [
    // Regular class with instance methods — not a static-only utility
    `class Service {
      private data: string = "";
      constructor() {}
      process() { return this.data; }
    }`,
    // Class with public constructor — not a static-only utility
    `class MathUtils {
      constructor() {}
      static add(a: number, b: number): number {
        return a + b;
      }
    }`,
    // Class with instance fields — not a static-only utility
    `class Counter {
      count: number = 0;
      static reset(): Counter { return new Counter(); }
      increment() { this.count++; }
    }`,
    // Class with non-static methods — not a static-only utility
    `class MathUtils {
      private constructor() {}
      add(a: number, b: number): number {
        return a + b;
      }
    }`,
    // Plain function — the recommended alternative (should not trigger)
    `function add(a: number, b: number): number {
      return a + b;
    }`,
  ],
  invalid: [
    {
      code: `class MathUtils {
        private constructor() {}
        static add(a: number, b: number): number {
          return a + b;
        }
      }`,
      errors: [{ messageId: "staticOnlyUtility" }],
    },
    {
      code: `class StringHelpers {
        private constructor() {}
        static trim(s: string): string {
          return s.trim();
        }
        static upper(s: string): string {
          return s.toUpperCase();
        }
      }`,
      errors: [{ messageId: "staticOnlyUtility" }],
    },
    {
      code: `class Config {
        private constructor() {}
        static base: string = "/api";
        static url(path: string): string { return this.base + path; }
      }`,
      errors: [{ messageId: "staticOnlyUtility" }],
    },
  ],
});
