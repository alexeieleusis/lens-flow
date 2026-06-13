import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutable-array-parameter-uc17.js";

ruleTester.run("no-mutable-array-parameter-uc17", rule, {
  valid: [
    // readonly T[] is safe
    `function processAnimals(animals: readonly Animal[]) {
      return animals.map(a => a.species);
    }`,
    // ReadonlyArray<T> is safe
    `function processAnimals(animals: ReadonlyArray<Animal>): void {}`,
    // Arrow function with readonly
    `const fn = (items: readonly string[]) => {}`,
    // Interface method with readonly
    `interface Processor {
      process(items: readonly Item[]): void;
    }`,
    // Function expression with ReadonlyArray
    `const fn = function(arr: ReadonlyArray<string>): void {}`,
  ],
  invalid: [
    // T[] syntax triggers the rule
    {
      code: `function processAnimals(animals: Animal[]) {
        animals.push(new Dog());
      }`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // Array<T> syntax triggers the rule
    {
      code: `function processItems(items: Array<Item>): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // Arrow function with mutable array
    {
      code: `const fn = (arr: string[]) => {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // Interface method with mutable array
    {
      code: `interface Processor {
        process(items: Item[]): void;
      }`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // Function expression with Array<T>
    {
      code: `const fn = function(arr: Array<string>): void {}`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
  ],
});
