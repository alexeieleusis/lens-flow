import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-protected-mutable-primitive-state.js";

ruleTester.run("no-protected-mutable-primitive-state", rule, {
  valid: [
    // Private field with protected setter is fine
    `export class Base {
      #state = 0;
      getState() { return this.#state; }
      protected setState(value: number) {
        if (value < 0) throw new Error();
        this.#state = value;
      }
    }`,
    // Readonly protected primitive is fine
    `export class Config {
      protected readonly maxRetries: number = 3;
    }`,
    // Protected non-primitive is fine
    `export class Store {
      protected items: string[] = [];
    }`,
    // Protected without initializer is fine
    `export class Base {
      protected state: number;
    }`,
    // Public mutable primitive is not flagged by this rule
    `export class Base {
      public state: number = 0;
    }`,
  ],
  invalid: [
    {
      code: `export class Base {
        protected state: number = 0;
        getState() { return this.state; }
      }`,
      errors: [{ messageId: "protectedMutablePrimitive" }],
    },
    {
      code: `export class Manager {
        protected active: boolean = true;
      }`,
      errors: [{ messageId: "protectedMutablePrimitive" }],
    },
    {
      code: `export class Label {
        protected name: string = "default";
      }`,
      errors: [{ messageId: "protectedMutablePrimitive" }],
    },
    {
      code: `export class Multi {
        protected count: number = 0;
        protected flag: boolean = false;
      }`,
      errors: [
        { messageId: "protectedMutablePrimitive" },
        { messageId: "protectedMutablePrimitive" },
      ],
    },
    {
      code: `export class UnionType {
        protected value: number | boolean = 0;
      }`,
      errors: [{ messageId: "protectedMutablePrimitive" }],
    },
    {
      code: `export class Quoted {
        protected "state": number = 0;
      }`,
      errors: [{ messageId: "protectedMutablePrimitive" }],
    },
  ],
});
