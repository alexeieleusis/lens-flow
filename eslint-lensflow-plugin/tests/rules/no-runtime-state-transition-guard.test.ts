import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-runtime-state-transition-guard.js";

ruleTester.run("no-runtime-state-transition-guard", rule, {
  valid: [
    `class StateMachine<S> {
  static idle(): StateMachine<Idle> { return new StateMachine<Idle>(); }
}
interface StateMachine<S extends Running> {
  stop(): StateMachine<Idle>;
}
interface StateMachine<S extends Idle> {
  start(): StateMachine<Running>;
}`,
    `class Counter {
  private count = 0;
  increment() {
    if (this.count > 10) return;
    this.count++;
  }
}`,
    `class Guard {
  check(value: string) {
    if (value !== "expected") {
      console.log("mismatch");
    }
  }
}`,
    `class Safe {
  private state = "idle";
  transition() {
    if (this.state === "idle") {
      this.state = "running";
    }
  }
}`,
    `class Machine {
  private state = "idle";
  start() {
    items.forEach(() => {
      if (this.state !== "idle") throw new Error();
    });
    this.state = "running";
  }
}`,
    `class Processor {
  private mode = "off";
  run() {
    const handler = function () {
      if (this.mode !== "off") throw new Error();
    };
    handler();
    this.mode = "on";
  }
}`,
  ],
  invalid: [
    {
      code: `class StateMachineBad {
  private state = "idle";
  start() {
    if (this.state !== "idle") throw new Error();
    this.state = "running";
  }
  stop() {
    if (this.state !== "running") throw new Error();
    this.state = "idle";
  }
}`,
      errors: [
        { messageId: "runtimeStateGuard" },
        { messageId: "runtimeStateGuard" },
      ],
    },
    {
      code: `class Machine {
  private mode: string = "off";
  turnOn() {
    if (this.mode != "off") throw new Error("Already on");
    this.mode = "on";
  }
}`,
      errors: [{ messageId: "runtimeStateGuard" }],
    },
    {
      code: `class Parser {
  private phase = "init";
  run() {
    if (this.phase !== "init") throw new Error("Already started");
    this.phase = "parsing";
  }
}`,
      errors: [{ messageId: "runtimeStateGuard" }],
    },
    {
      code: `class StateMachineReversed {
  private state = "idle";
  start() {
    if ("idle" !== this.state) throw new Error();
    this.state = "running";
  }
}`,
      errors: [{ messageId: "runtimeStateGuard" }],
    },
  ],
});
