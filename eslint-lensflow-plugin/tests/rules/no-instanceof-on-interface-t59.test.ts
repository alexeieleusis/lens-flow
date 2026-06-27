import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-instanceof-on-interface-t59.js";

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

ruleTester.run("no-instanceof-on-interface-t59", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface Printable {
  print(): string;
}

class Dog implements Printable {
  print() { return "Dog"; }
  bark() { return "Woof!"; }
}

const a: Printable = new Dog();
console.log(a.print());`,
    },
    {
      filename: TEST_FILENAME,
      code: `class Dog {
  print(): string { return "Dog"; }
  bark(): string { return "Woof!"; }
}

const a: Dog = new Dog();
if (a instanceof Dog) {
  a.bark();
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `interface Printable {
  print(): string;
}

class Dog implements Printable {
  print() { return "Dog"; }
  bark() { return "Woof!"; }
}

const a: Printable = new Dog();
if (a instanceof Dog) {
  a.bark();
}`,
      errors: [{ messageId: "instanceofOnInterface" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface Drawable {
  draw(): void;
}

class Circle implements Drawable {
  draw() {}
  getRadius() { return 1; }
}

const shape: Drawable = new Circle();
if (shape instanceof Circle) {
  shape.getRadius();
}`,
      errors: [{ messageId: "instanceofOnInterface" }],
    },
  ],
});
