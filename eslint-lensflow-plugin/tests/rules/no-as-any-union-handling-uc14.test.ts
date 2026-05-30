import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-union-handling-uc14.js";

ruleTester.run("no-as-any-union-handling-uc14", rule, {
  valid: [
    // Proper type narrowing instead of `as any`
    `type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number; height: number };
function area(s: Shape) {
  if (s.kind === "circle") return Math.PI * s.radius ** 2;
  throw new Error("not a circle");
}`,
    // Function with only primitive params — rule does not apply
    `function add(a: number, b: number) {
  return (a as any) + (b as any);
}`,
    // No enclosing function (module-level code)
    `const x = (globalThis as any).someProp;`,
  ],
  invalid: [
    // Direct `as any` on union-typed parameter
    {
      code: `type Shape = { kind: "circle"; radius: number } | { kind: "rect"; width: number };
function handle(s: Shape) {
  const r = (s as any).radius;
  return Math.PI * r ** 2;
}`,
      errors: [{ messageId: "asAnyBypassNarrowing" }],
    },
    // Arrow function with union parameter
    {
      code: `type State = { kind: "loading"; data?: never } | { kind: "done"; data: string };
const getState = (s: State) => (s as any).data;`,
      errors: [{ messageId: "asAnyBypassNarrowing" }],
    },
  ],
});
