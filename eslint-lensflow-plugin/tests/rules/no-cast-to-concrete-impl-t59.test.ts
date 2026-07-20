import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-cast-to-concrete-impl-t59.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG,
      tsconfigRootDir: TS_CONFIG_DIR,
    },
  },
});

ruleTester.run("no-cast-to-concrete-impl-t59", rule, {
  valid: [
    // Only using interface members — no cast to concrete class
    {
      filename: TEST_FILENAME,
      code: `interface Printable {
  print(): string;
}

const animal: Printable = {} as Printable;
console.log(animal.print());`,
    },
    // Cast to a different interface is fine
    {
      filename: TEST_FILENAME,
      code: `interface Printable {
  print(): string;
}

interface Named {
  name: string;
}

const obj: Printable = {} as Printable;
const named = obj as Named;`,
    },
    // Variable is not interface-typed
    {
      filename: TEST_FILENAME,
      code: `class Dog {
  print(): string { return "Dog"; }
  bark(): string { return "Woof!"; }
}

const dog: Dog = new Dog();
const x = dog as Dog;`,
    },
    // Cast to class not implementing the source interface
    {
      filename: TEST_FILENAME,
      code: `interface Printable { print(): string; }
class Cat { meow(): string { return "Meow!"; } }
const animal: Printable = {} as Printable;
const x = animal as Cat;`,
    },
  ],
  invalid: [
    // Direct cast from interface to concrete implementing class
    {
      filename: TEST_FILENAME,
      code: `interface Printable {
  print(): string;
}

class Dog implements Printable {
  print() { return "Dog"; }
  bark() { return "Woof!"; }
}

const animal: Printable = new Dog();
(animal as Dog).bark();`,
      errors: [{ messageId: "castToConcreteImpl" }],
    },
    // Cast used in assignment
    {
      filename: TEST_FILENAME,
      code: `interface Serializable {
  serialize(): string;
}

class User implements Serializable {
  serialize() { return "{}"; }
  getSecret() { return "secret"; }
}

const entity: Serializable = new User();
const user = entity as User;`,
      errors: [{ messageId: "castToConcreteImpl" }],
    },
    // Cast inside a function call
    {
      filename: TEST_FILENAME,
      code: `interface Renderable {
  render(): void;
}

class Button implements Renderable {
  render() {}
  onClick() {}
}

const view: Renderable = new Button();
(view as Button).onClick();`,
      errors: [{ messageId: "castToConcreteImpl" }],
    },
  ],
});
