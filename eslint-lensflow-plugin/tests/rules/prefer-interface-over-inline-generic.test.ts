import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-interface-over-inline-generic.js";

ruleTester.run("prefer-interface-over-inline-generic", rule, {
  valid: [
    // Correct: uses named interface
    `interface Runnable { run(): void; }
function process(item: Runnable) {
  item.run();
}`,
    // No generic type parameters at all
    `function process(item: { run(): void }) {
  item.run();
}`,
    // Generic constrained by a named type (TSTypeReference), not inline literal
    `interface Base { id: string; }
function handle<T extends Base>(item: T) {
  return item.id;
}`,
    // Return type references the type parameter — legitimate use of generic
    `function identity<T extends { value: number }>(item: T): T {
  return item;
}`,
    // Generic with no constraint
    `function wrap<T>(value: T): T {
  return value;
}`,
    // Multiple type params but none with inline literal constraint
    `interface Comparable { compareTo(other: this): number; }
function compare<T extends Comparable, U extends Comparable>(a: T, b: U) {
  return a.compareTo(b);
}`,
    // TSDeclareFunction — return type references T, legitimate use
    `declare function identity<T extends { value: number }>(item: T): T;`,
    // TSFunctionType — return type references T, legitimate use
    `type Identity = <T extends { value: number }>(item: T) => T;`,
    // TSMethodSignature — return type references T, legitimate use
    `interface Service {
  transform<T extends { value: number }>(item: T): T;
}`,
    // MethodDefinition — return type references T, legitimate use
    `class Service {
  transform<T extends { value: number }>(item: T): T {
    return item;
  }
}`,
    // TSCallSignatureDeclaration — return type references T, legitimate use
    `interface IdentityFn {
  <T extends { value: number }>(item: T): T;
}`,
  ],
  invalid: [
    // Basic case from the spec
    {
      code: `function process<T extends { run(): void }>(item: T) {
  item.run();
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // Arrow function with inline type literal constraint
    {
      code: `const handler = <T extends { execute(): void }>(item: T) => {
  item.execute();
};`,
      errors: [{ messageId: "preferInterface" }],
    },
    // Function expression with inline type literal constraint
    {
      code: `const fn = function <T extends { name: string; age: number }>(item: T) {
  console.log(item.name, item.age);
};`,
      errors: [{ messageId: "preferInterface" }],
    },
    // Multiple type params, one with inline literal (should report once)
    {
      code: `interface Base { id: string; }
function multi<T extends Base, U extends { value: number }>(a: T, b: U) {
  console.log(a.id, b.value);
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // Return type is explicitly void (not referencing T)
    {
      code: `function run<T extends { start(): void }>(item: T): void {
  item.start();
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // Return type is a different named type
    {
      code: `interface Result { ok: boolean; }
function execute<T extends { run(): void }>(item: T): Result {
  item.run();
  return { ok: true };
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // TSDeclareFunction — ambient function with inline type literal constraint
    {
      code: `declare function ambient<T extends { value: number }>(item: T): void;`,
      errors: [{ messageId: "preferInterface" }],
    },
    // TSFunctionType — function type alias with inline type literal constraint
    {
      code: `type Handler = <T extends { data: string }>(item: T) => void;`,
      errors: [{ messageId: "preferInterface" }],
    },
    // TSMethodSignature — interface method with inline type literal constraint
    {
      code: `interface Service {
  handle<T extends { id: string }>(item: T): void;
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // MethodDefinition — class method with inline type literal constraint
    {
      code: `class Service {
  process<T extends { run(): void }>(item: T) {
    item.run();
  }
}`,
      errors: [{ messageId: "preferInterface" }],
    },
    // TSCallSignatureDeclaration — callable interface with inline type literal constraint
    {
      code: `interface Api {
  <T extends { execute(): void }>(item: T): void;
}`,
      errors: [{ messageId: "preferInterface" }],
    },
  ],
});
