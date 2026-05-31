import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-instanceof-over-constructor-name.js";

ruleTester.run("prefer-instanceof-over-constructor-name", rule, {
  valid: [
    `class Garage {
  isCar(): this is Car { return this instanceof Car; }
}`,
    `function check(obj: unknown): obj is Car {
  return obj instanceof Car;
}`,
    `const name = obj.constructor.name;`,
    `if (x.constructor.name) { doSomething(); }`,
  ],
  invalid: [
    {
      code: `class Garage {
  isCar(): this is Car { return this.constructor.name === "Car"; }
}`,
      errors: [{ messageId: "preferInstanceof" }],
    },
    {
      code: `class Animal {
  isDog(): this is Dog { return this.constructor.name == "Dog"; }
}`,
      errors: [{ messageId: "preferInstanceof" }],
    },
    {
      code: `class Zoo {
  check(): boolean {
    return "Cat" === this.constructor.name;
  }
}`,
      errors: [{ messageId: "preferInstanceof" }],
    },
  ],
});
