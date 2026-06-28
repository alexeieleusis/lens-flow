import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutable-state-runtime-guards.js";

ruleTester.run("no-mutable-state-runtime-guards", rule, {
  valid: [
    `class Document<S> {
      private constructor(private content: string, private _state: S = {} as any) {}
      static create(content: string): Document<"Draft"> { return new Document(content); }
    }`,
    `class Fine {
      readonly state: "draft" | "published" = "draft";
      edit(content: string) {
        this.content = content;
      }
    }`,
    `class NoThrow {
      state: "a" | "b" = "a";
      check() {
        if (this.state !== "a") {
          console.log("not a");
        }
      }
    }`,
    `class NoStateProp {
      count: number = 0;
      inc() {
        if (this.count === 0) throw new Error("zero");
      }
    }`,
    `class NestedCallback {
      state: "a" | "b" = "a";
      run() {
        const handler = () => {
          if (this.state !== "a") throw new Error();
        };
        handler();
      }
    }`,
    `class ElseThrowNonState {
      count: number = 0;
      check() {
        if (this.count === 0) {
          // do something
        } else {
          throw new Error("must be zero");
        }
      }
    }`,
  ],
  invalid: [
    {
      code: `class Document {
        state: "draft" | "published" = "draft";
        edit(content: string) {
          if (this.state !== "draft") throw new Error("Cannot edit published doc");
          this.content = content;
        }
      }`,
      errors: [{ messageId: "mutableStateRuntimeGuard" }],
    },
    {
      code: `class Order {
        status: "pending" | "shipped" | "delivered" = "pending";
        addItem(item: string) {
          if (this.status === "delivered") {
            throw new Error("Order already delivered");
          }
          this.items.push(item);
        }
      }`,
      errors: [{ messageId: "mutableStateRuntimeGuard" }],
    },
    {
      code: `class Workflow {
        phase: "start" | "middle" | "end" = "start";
        run() {
          if (this.phase !== "start") {
            throw new Error("Not at start");
          }
        }
        finish() {
          if (this.phase === "end") throw new Error("Already finished");
        }
      }`,
      errors: [
        { messageId: "mutableStateRuntimeGuard" },
        { messageId: "mutableStateRuntimeGuard" },
      ],
    },
    {
      code: `class ElseThrowGuard {
        state: "a" | "b" = "a";
        run() {
          if (this.state === "b") {
            // do something
          } else {
            throw new Error("must be b");
          }
        }
      }`,
      errors: [{ messageId: "mutableStateRuntimeGuard" }],
    },
  ],
});
