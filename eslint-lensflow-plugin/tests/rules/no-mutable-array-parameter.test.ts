import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutable-array-parameter.js";

ruleTester.run("no-mutable-array-parameter", rule, {
  valid: [
    `function processItems(items: readonly Item[]): void {}`,
    `function processItems(items: ReadonlyArray<Item>): void {}`,
    `const fn = (items: readonly string[]) => {}`,
    `interface Processor {
      process(items: readonly Item[]): void;
    }`,
    `function addAnimal(animals: readonly Animal[]): void {}`,
    `function addAnimal(animals: ReadonlyArray<Animal>): void {}`,
    `declare function processItems(items: readonly Item[]): void;`,
    `function processItems(items: readonly Item[] = []): void {}`,
    `function processItems(items: ReadonlyArray<Item> = []): void {}`,
  ],
  invalid: [
    {
      code: `function addAnimal(animals: Animal[]): void {
        animals.push(new Cat());
      }`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `function processItems(items: Array<Item>): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `const fn = (arr: string[]) => {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `interface Processor {
        process(items: Item[]): void;
      }`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `const fn = function(arr: Array<string>): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `declare function processItems(items: Item[]): void;`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `function processItems(items: string[] = []): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `function processItems(items: Array<Item> = []): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    {
      code: `const fn = (arr: string[] = ["default"]) => {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
  ],
});
