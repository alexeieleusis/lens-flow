import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-union-handling-uc14.js";

ruleTester.run("no-as-any-union-handling-uc14", rule, {
  valid: [
    // Proper type narrowing instead of `as any`
    `function area(s: { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number }) {
  if (s.kind === "circle") return Math.PI * s.radius ** 2;
  throw new Error("not a circle");
}`,
    // Function with only primitive params — rule does not apply
    `function add(a: number, b: number) {
  return (a as any) + (b as any);
}`,
    // No enclosing function (module-level code)
    `const x = (globalThis as any).someProp;`,
    // Non-union type alias — rule should NOT apply
    `type User = { name: string; age: number };
function greet(u: User) {
  const n = (u as any).name;
  return n;
}`,
    // Array parameter — rule should NOT apply
    `function process(items: string[]) {
  return (items as any).length;
}`,
    // Shadowed parameter in nested function — should NOT flag
    `function outer(s: { kind: "a" } | { kind: "b" }) {
  const inner = (s: string) => (s as any).trim();
}`,
    // AssignmentPattern — proper narrowing with default parameter
    `function handle(s: ({ kind: "a" } | { kind: "b" }) = { kind: "a" }) {
  if (s.kind === "a") return s;
  throw new Error("not a");
}`,
  ],
  invalid: [
    // Direct `as any` on inline union-typed parameter
    {
      code: `function handle(s: { kind: "circle"; radius: number } | { kind: "rect"; width: number }) {
  const r = (s as any).radius;
  return Math.PI * r ** 2;
}`,
      errors: [{ messageId: "asAnyBypassNarrowing" }],
    },
    // Arrow function with inline union parameter
    {
      code: `const getState = (s: { kind: "loading"; data?: never } | { kind: "done"; data: string }) => (s as any).data;`,
      errors: [{ messageId: "asAnyBypassNarrowing" }],
    },
    // AssignmentPattern — `as any` bypass with default parameter
    {
      code: `function handle(s: ({ kind: "a" } | { kind: "b" }) = { kind: "a" }) {
  return (s as any).kind;
}`,
      errors: [{ messageId: "asAnyBypassNarrowing" }],
    },
  ],
});
