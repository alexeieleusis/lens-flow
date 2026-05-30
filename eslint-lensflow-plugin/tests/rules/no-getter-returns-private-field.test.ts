import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-getter-returns-private-field.js";

ruleTester.run("no-getter-returns-private-field", rule, {
  valid: [
    // Getter returns a sub-property of private field (immutable view)
    `class Document {
      #metadata: { author: string; tags: string[] };
      get tags(): readonly string[] {
        return this.#metadata.tags;
      }
    }`,
    // Getter returns a public field
    `class Safe {
      publicData: string = "";
      get data() {
        return this.publicData;
      }
    }`,
    // Getter returns a computed value
    `class Counter {
      #count: number = 0;
      get doubled() {
        return this.#count * 2;
      }
    }`,
    // Non-getter method returning private field is fine
    `class Leaky {
      #data: string = "";
      getData() {
        return this.#data;
      }
    }`,
    // Getter with no return
    `class NoReturn {
      #value: number = 0;
      get log() {
        console.log(this.#value);
      }
    }`,
    // Getter returns sub-property of private field
    `class Widget {
      #config: { mode: string; debug: boolean };
      get mode() {
        return this.#config.mode;
      }
    }`,
  ],
  invalid: [
    {
      code: `class Document {
        #metadata: { author: string; tags: string[] };
        get internals() {
          return this.#metadata;
        }
      }`,
      errors: [{ messageId: "leaksPrivateField" }],
    },
    {
      code: `class Store {
        #state: Record<string, unknown>;
        get state() {
          return this.#state;
        }
      }`,
      errors: [{ messageId: "leaksPrivateField" }],
    },
    {
      code: `class Widget {
        #config: { mode: string; debug: boolean };
        get config() {
          return this.#config;
        }
      }`,
      errors: [{ messageId: "leaksPrivateField" }],
    },
  ],
});
