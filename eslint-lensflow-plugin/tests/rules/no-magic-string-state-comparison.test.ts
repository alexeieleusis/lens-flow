import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-magic-string-state-comparison.js";

ruleTester.run("no-magic-string-state-comparison", rule, {
  valid: [
    // Comparison without assignment to same property in consequent
    `class Order {
      status: "pending" | "confirmed" | "shipped";
      check() {
        if (this.status === "confirmed") {
          console.log("confirmed!");
        }
      }
    }`,

    // Assignment in consequent but to a different property
    `class Order {
      status: "pending" | "confirmed";
      flag: boolean;
      update() {
        if (this.status === "pending") {
          this.flag = true;
        }
      }
    }`,

    // Comparison with non-string literal
    `class Order {
      count: number;
      reset() {
        if (this.count === 0) {
          this.count = -1;
        }
      }
    }`,

    // IfStatement outside a method (top-level code)
    `if (foo.status === "ready") {
  foo.status = "done";
}`,

    // Non-this member expression
    `class Order {
      process(other: { status: string }) {
        if (other.status === "confirmed") {
          other.status = "shipped";
        }
      }
    }`,

    // Assignment inside nested arrow function — should NOT report
    `class Order {
      status: string;
      ship() {
        if (this.status === "confirmed") {
          const handler = () => { this.status = "shipped"; };
        }
      }
    }`,
  ],
  invalid: [
    {
      code: `class Order {
      status: "pending" | "confirmed" | "shipped";
      ship() {
        if (this.status === "confirmed") {
          this.status = "shipped";
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
    {
      code: `class Workflow {
      state: "idle" | "running" | "done";
      start() {
        if (this.state === "idle") {
          this.state = "running";
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
    {
      code: `class Task {
      phase: "new" | "in-progress" | "completed";
      complete() {
        if ("completed" === this.phase) {
          this.phase = "completed";
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
    {
      code: `class Machine {
      mode: "a" | "b";
      switch() {
        if (this.mode == "a") {
          this.mode = "b";
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
    {
      code: `class Order {
      status: string;
      process() {
        if (this.status === "confirmed") {
          doSomething();
          this.status = "shipped";
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
    {
      code: `class Order {
      status: string;
      process() {
        if (this.status === "pending") {
          for (const item of this.items) {
            this.status = "processing";
          }
        }
      }
    }`,
      errors: [{ messageId: "magicStringStateComparison" }],
    },
  ],
});
