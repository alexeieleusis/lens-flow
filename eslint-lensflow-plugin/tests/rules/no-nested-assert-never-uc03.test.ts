import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-assert-never-uc03.js";

ruleTester.run("no-nested-assert-never-uc03", rule, {
  valid: [
    // Switch covers all variants without pre-filtering conditional
    `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  switch (a.type) {
    case "push": console.log("push"); break;
    case "pop": console.log("pop"); break;
    case "clear": console.log("clear"); break;
    default: assertNever(a);
  }
}`,
    // Switch covers all variants without pre-filtering conditional
    `type State = { kind: "a" } | { kind: "b" };

function assertNever(x: never): never {
  throw new Error(x);
}

function handle(s: State) {
  switch (s.kind) {
    case "a": console.log("a"); break;
    case "b": console.log("b"); break;
    default: assertNever(s);
  }
}`,
    // No default case with assertNever
    `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  if (a.type !== "clear") {
    switch (a.type) {
      case "push": console.log("push"); break;
      default: return;
    }
  }
}`,
    // Switch discriminant doesn't match if condition
    `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  if (a.other === "x") {
    switch (a.type) {
      case "push": console.log("push"); break;
      case "pop": console.log("pop"); break;
      case "clear": console.log("clear"); break;
      default: assertNever(a);
    }
  }
}`,
    // Switch inside nested function scope — must not attribute outer if as ancestor
    `type Action = { type: "a" } | { type: "b" };

function handle(a: Action) {
  if (a.type !== "b") {
    fn(() => {
      switch (a.type) {
        case "a": console.log("a"); break;
        default: assertNever(a);
      }
    });
  }
}`,
  ],
  invalid: [
    // Basic pattern: if filters on same discriminant, nested switch has assertNever
    {
      code: `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  if (a.type !== "clear") {
    switch (a.type) {
      case "push": console.log("push"); break;
      default: assertNever(a);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Same pattern with === instead of !==
    {
      code: `type Status = { kind: "pending" | "done" } | { kind: "cancelled" };

function handle(s: Status) {
  if (s.kind === "cancelled") {
    switch (s.kind) {
      case "cancelled": console.log("cancelled"); break;
      default: assertNever(s);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Loose equality variant
    {
      code: `type Event = { type: "start" | "stop" } | { type: "reset" };

function handle(e: Event) {
  if (e.type != "reset") {
    switch (e.type) {
      case "start": console.log("start"); break;
      default: assertNever(e);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Loose equality == variant
    {
      code: `type Status = { kind: "pending" | "done" } | { kind: "cancelled" };

function handle(s: Status) {
  if (s.kind == "cancelled") {
    switch (s.kind) {
      case "cancelled": console.log("cancelled"); break;
      default: assertNever(s);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Discriminant on right side of comparison
    {
      code: `type Msg = { tag: "foo" } | { tag: "bar" | "baz" };

function handle(m: Msg) {
  if ("foo" !== m.tag) {
    switch (m.tag) {
      case "bar": console.log("bar"); break;
      default: assertNever(m);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Switch in else branch of filtering conditional
    {
      code: `type State = { kind: "a" } | { kind: "b" };

function assertNever(x: never): never {
  throw new Error(x);
}

function handle(s: State) {
  if (s.kind === "a") {
    console.log("a");
  } else {
    switch (s.kind) {
      case "b": console.log("b"); break;
      default: assertNever(s);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // Deeply nested assertNever as function argument
    {
      code: `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  if (a.type !== "clear") {
    switch (a.type) {
      case "push": console.log("push"); break;
      default: foo(assertNever(a));
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
    // assertNever nested inside ternary expression
    {
      code: `type Action = { type: "push" | "pop" } | { type: "clear" };

function handle(a: Action) {
  if (a.type !== "clear") {
    switch (a.type) {
      case "push": console.log("push"); break;
      default: (a.type === "x") ? assertNever(a) : assertNever(a);
    }
  }
}`,
      errors: [{ messageId: "nestedAssertNever" }],
    },
  ],
});
