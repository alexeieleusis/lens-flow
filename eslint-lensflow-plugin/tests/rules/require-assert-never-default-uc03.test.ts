import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-assert-never-default-uc03.js";

ruleTester.run("require-assert-never-default-uc03", rule, {
  valid: [
    `type Shape =
  | { kind: "Circle"; radius: number }
  | { kind: "Rectangle"; width: number; height: number }
  | { kind: "Triangle"; base: number; height: number };

function assertNever(x: never): never {
  throw new Error(\`Unexpected value: \${x}\`);
}

function area(s: Shape): number {
  switch (s.kind) {
    case "Circle": return Math.PI * s.radius ** 2;
    case "Rectangle": return s.width * s.height;
    case "Triangle": return 0.5 * s.base * s.height;
    default: assertNever(s);
  }
}`,
    `type Status =
  | { kind: "pending" }
  | { kind: "complete" };

function assertNever(x: never): never {
  throw new Error(\`Unexpected: \${x}\`);
}

function handle(s: Status): string {
  switch (s.kind) {
    case "pending": return "waiting";
    case "complete": return "done";
    default: assertNever(s);
  }
}`,
    `function foo(x: string) {
  switch (x) {
    case "a": return 1;
    default: return 0;
  }
}`,
    `function bar(s: { kind: string }) {
  switch (s.kind) {
    case "a": return 1;
    default: return 0;
  }
}`,
    `function f(x: number) {
  switch (x) {
    case 1: return "one";
    case 2: return "two";
    default: return "other";
  }
}`,
    `type S = { kind: "A" } | { kind: "B" };
function assertNever(x: never): never {
  throw new Error(\`Unexpected: \${x}\`);
}
function f(s: S) {
  switch (s.kind) {
    case "A": return 1;
    case "B": return 2;
    default:
      console.log("unexpected:", s);
      assertNever(s);
  }
}`,
  ],
  invalid: [
    {
      code: `type Shape =
  | { kind: "Circle"; radius: number }
  | { kind: "Rectangle"; width: number; height: number }
  | { kind: "Triangle"; base: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case "Circle": return Math.PI * s.radius ** 2;
    case "Rectangle": return s.width * s.height;
    // forgot Triangle!
    default: return 0;
  }
}`,
      errors: [{ messageId: "missingAssertNever" }],
    },
    {
      code: `type State =
  | { type: "loading" }
  | { type: "success"; data: string }
  | { type: "error"; message: string };

function render(state: State): string {
  switch (state.type) {
    case "loading": return "Loading...";
    case "success": return state.data;
    case "error": return state.message;
    default: return "unknown";
  }
}`,
      errors: [{ messageId: "missingAssertNever" }],
    },
    {
      code: `function handle(s: { kind: string }): number {
  switch (s.kind) {
    case "a": return 1;
    case "b": return 2;
    default: break;
  }
  return 0;
}`,
      errors: [{ messageId: "breakOnlyDefault" }],
    },
    {
      code: `function handle(s: { kind: string }): number {
  switch (s.kind) {
    case "a": return 1;
    case "b": return 2;
    default:
  }
}`,
      errors: [{ messageId: "emptyDefault" }],
    },
    {
      code: `type S = { kind: "A" } | { kind: "B" };
function f(s: S) {
  switch (s.kind) {
    case "A": return 1;
    case "B": return 2;
    default:
      const fn = () => assertNever(s);
      return 0;
  }
}`,
      errors: [{ messageId: "missingAssertNever" }],
    },
  ],
});
