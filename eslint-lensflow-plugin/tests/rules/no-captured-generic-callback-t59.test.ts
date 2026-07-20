import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-captured-generic-callback-t59.js";

ruleTester.run("no-captured-generic-callback-t59", rule, {
  valid: [
    // Generic callback used only within its scope — no capture
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  return run("secret");
}`,

    // Non-generic callback parameter assigned outside — not flagged
    `let outerCb: (x: string) => void;

function process(run: (x: string) => void) {
  outerCb = run;
}`,

    // Generic callback assigned to a local variable inside same function
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  const local = run;
  return local("secret");
}`,

    // Generic callback passed through, not assigned
    `function wrapper<Result>(run: <T>(s: T) => Result): Result {
  return transform(run, "data");
}`,

    // Arrow function: generic callback used inline
    `const fn = <Result>(run: <T>(s: T) => Result): Result => {
  return run("secret");
}`,

    // Capturing into a block-scoped local (declared in a nested block)
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  if (true) {
    const local = run;
    return local("secret");
  }
}`,

    // Variable declared inside a for loop — nested deeper than top-level statements
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  for (const item of [1]) {
    const local = run;
    return local("secret");
  }
}`,

    // Variable declared inside a try block — nested deeper than top-level statements
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  try {
    const local = run;
    return local("secret");
  } catch {
    return run("fallback");
  }
}`,

    // Assigning to a property on a local object declared inside the same function
    `function withSecret<Result>(run: <T>(s: T) => Result): Result {
  const box = { cb: null };
  box.cb = run;
  return box.cb("secret");
}`,

    // Shadowing regression: nested function shadows generic callback param name with a non-generic param of the same name,
    // and assigns it to an outer variable — should NOT be flagged (the captured param is the inner non-generic one)
    `let outerVar: (x: string) => void;

function outer(run: <T>(s: T) => Result): Result {
  function inner(run: (x: string) => void) {
    outerVar = run;
  }
  return run("secret");
}`,
  ],
  invalid: [
    // Assignment to module-level variable
    {
      code: `let capturedCallback: <T>(x: T) => void;

function withSecret<Result>(run: <T>(s: T) => Result): Result {
  capturedCallback = run;
  return run("secret");
}`,
      errors: [{ messageId: "capturedGenericCallback" }],
    },

    // Assignment to outer variable declared with let
    {
      code: `let leaked;

function withSecret<Result>(run: <T>(s: T) => Result): Result {
  leaked = run;
  return run("secret");
}`,
      errors: [{ messageId: "capturedGenericCallback" }],
    },

    // Arrow function: capture to outer variable
    {
      code: `let leakedCb: <T>(x: T) => void;

const factory = <Result>(cb: <T>(s: T) => Result): Result => {
  leakedCb = cb;
  return cb("data");
}`,
      errors: [{ messageId: "capturedGenericCallback" }],
    },

    // Assignment to class instance property (MemberExpression target)
    {
      code: `class Store {
  cb: <T>(x: T) => void = () => {};
}

const store = new Store();

function withSecret<Result>(run: <T>(s: T) => Result): Result {
  store.cb = run;
  return run("secret");
}`,
      errors: [{ messageId: "capturedGenericCallback" }],
    },

    // Function boundary enforcement: generic callback captured at outer scope,
    // nested function declares a variable with the same name — walker must not confuse them
    {
      code: `let capturedCallback: <T>(x: T) => void;

function withSecret<Result>(run: <T>(s: T) => Result): Result {
  capturedCallback = run;

  function inner() {
    let capturedCallback: string;
    capturedCallback = "inner shadow";
  }

  return run("secret");
}`,
      errors: [{ messageId: "capturedGenericCallback" }],
    },
  ],
});
