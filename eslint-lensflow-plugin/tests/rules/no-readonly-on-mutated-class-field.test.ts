import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-readonly-on-mutated-class-field.js";

ruleTester.run("no-readonly-on-mutated-class-field", rule, {
  valid: [
    `class Counter {
      count = 0;
      increment() { this.count++; }
    }`,
    `class Counter {
      readonly count = 0;
    }`,
    `class Counter {
      readonly count: number;
      constructor() { this.count = 0; }
    }`,
    `class Counter {
      readonly count = 0;
      getDouble() { return this.count * 2; }
    }`,
    `class Counter {
      readonly count = 0;
      reset() { this.other = 5; }
    }`,
    `class Outer {
      readonly count = 0;
      constructor() {
        class Inner {
          readonly x = 1;
          constructor() { this.x = 2; }
        }
        this.count = 1;
      }
    }`,
  ],
  invalid: [
    {
      code: `class Counter {
        readonly count = 0;
        increment() { this.count++; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        readonly count = 0;
        setCount(n: number) { this.count = n; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        readonly count = 0;
        decrement() { this.count--; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Store {
        readonly items: string[] = [];
        pushItem(item: string) { this.items = [...this.items, item]; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        readonly count = 0;
        increment() { this.count += 1; }
        decrement() { this.count -= 1; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }, { messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        constructor(readonly count: number) {}
        increment() { this.count++; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Outer {
        readonly count = 0;
        inner() {
          class Inner {
            readonly x = 1;
          }
          this.count = 1;
        }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        readonly "count" = 0;
        increment() { this.count++; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
    {
      code: `class Counter {
        readonly #count = 0;
        increment() { this.#count++; }
      }`,
      errors: [{ messageId: "mutationOfReadonly" }],
    },
   ],
});
