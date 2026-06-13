import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-overengineered-intersection-constraint.js";

ruleTester.run("no-overengineered-intersection-constraint", rule, {
  valid: [
    `function findUser<T extends { id: string; name: string }>(items: T[], id: string): T | undefined {
      return items.find(x => x.id === id);
    }`,
    `function process<T extends SomeBase>(item: T): T {
      return item;
    }`,
    `function handle<T extends A | B>(item: T): void {}`,
    `function mixed<T extends A & { foo: number }>(item: T): void {}`,
  ],
  invalid: [
    {
      code: `interface CanId { id: string; }
interface CanName { name: string; }
function findUser<T extends CanId & CanName>(items: T[], id: string): T | undefined {
  return items.find(x => x.id === id);
}`,
      errors: [{ messageId: "overengineeredIntersection" }],
    },
    {
      code: `function foo<T extends A & B & C>(x: T): void {}`,
      errors: [{ messageId: "overengineeredIntersection" }],
    },
    {
      code: `class Service<T extends Repo & Cache & Logger> {}`,
      errors: [{ messageId: "overengineeredIntersection" }],
    },
  ],
});
