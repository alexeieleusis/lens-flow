import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-primitive-method-params.js";

ruleTester.run("prefer-primitive-method-params", rule, {
  valid: [
    // Multiple properties accessed — not a single-property extraction
    `class User {
      #name: string;
      setName(data: { name: string; email: string }) {
        this.#name = data.name;
        console.log(data.email);
      }
    }`,
    // Object passed as whole to another call
    `function process(data: { name: string }) {
      validate(data);
    }`,
    // Destructuring usage
    `function greet(data: { name: string }) {
      const { name } = data;
      console.log(name);
    }`,
    // Non-object parameter type
    `function setName(name: string) {
      console.log(name);
    }`,
    // Arrow function accessing multiple properties
    `const handler = (data: { name: string; age: number }) => {
      console.log(data.name, data.age);
    };`,
    // Nested function accessing single property — walk stops at function boundary
    `class User {
      setName(data: { name: string }) {
        const fn = () => data.name;
        fn();
      }
    }`,
  ],
  invalid: [
    {
      code: `class User {
      #name: string;
      setName(data: { name: string }) {
        this.#name = data.name;
      }
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function extractName(info: { name: string }) {
      return info.name;
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `const getName = (payload: { name: string }) => payload.name;`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function setLabel(config: { label: string }) {
      document.title = config.label;
      log(config.label);
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function f(data: { name: string }) { return data["name"]; }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
  ],
});
