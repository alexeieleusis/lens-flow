import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutable-array-parameter.js";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

const URL = knowledgeUrl(
  "usecases/UC17-variance.md",
  "Antipatterns with Other Techniques > Using mutable arrays instead of `readonly` + covariance",
);

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
    `function processAnimals(animals: readonly Animal[]) {
      return animals.map(a => a.species);
    }`,
    `function processAnimals(animals: ReadonlyArray<Animal>): void {}`,
    `const fn = function(arr: ReadonlyArray<string>): void {}`,
    // TSParameterProperty with ReadonlyArray — safe
    `class C { constructor(readonly arr: ReadonlyArray<string>) {} }`,
    `declare function fn(arr: readonly string[]): void;`,
    // TSFunctionType with ReadonlyArray
    `type Fn = (arr: ReadonlyArray<string>) => void;`,
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
    {
      code: `function processAnimals(animals: Animal[]) {
        animals.push(new Dog());
      }`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // TSParameterProperty with mutable T[] — readonly modifier.
    // Two identical errors are expected until
    // https://github.com/alexeieleusis/lens-flow/issues/357 is fixed.
    {
      code: `class C { constructor(readonly arr: string[]) {} }`,
      errors: [
        { messageId: "mutableArrayParam" },
        { messageId: "mutableArrayParam" },
      ],
    },
    // TSParameterProperty with mutable Array<T> — private modifier.
    // Two identical errors expected, see
    // https://github.com/alexeieleusis/lens-flow/issues/357
    {
      code: `class C { constructor(private arr: Array<number>) {} }`,
      errors: [
        { messageId: "mutableArrayParam" },
        { messageId: "mutableArrayParam" },
      ],
    },
    // TSDeclareFunction with mutable T[]
    {
      code: `declare function fn(arr: string[]): void;`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // TSFunctionType with mutable Array<T>
    {
      code: `type Fn = (arr: Array<string>) => void;`,
      errors: [{ messageId: "mutableArrayParam" }],
    },
    // Non-simple element types are parenthesized in the suggestion.
    {
      code: `function f(xs: (string | number)[]): void {}`,
      errors: [
        {
          messageId: "mutableArrayParam",
          data: {
            name: "xs",
            type: "(string | number)[]",
            elem: "string | number",
            elemGrouped: "(string | number)",
            url: URL,
          },
        },
      ],
    },
    {
      code: `function f(xs: Array<Item>): void {}`,
      errors: [
        {
          messageId: "mutableArrayParam",
          data: {
            name: "xs",
            type: "Array<Item>",
            elem: "Item",
            elemGrouped: "Item",
            url: URL,
          },
        },
      ],
    },
  ],
});
