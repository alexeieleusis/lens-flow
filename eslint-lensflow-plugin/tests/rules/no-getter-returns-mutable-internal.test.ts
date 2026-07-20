import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-getter-returns-mutable-internal.js";

ruleTester.run("no-getter-returns-mutable-internal", rule, {
  valid: [
    `class ShoppingCart {
      #items = new Set<string>();
      get items(): ReadonlySet<string> {
        return this.#items;
      }
    }`,
    `class ShoppingCart {
      #items = new Set<string>();
      get items(): readonly string[] {
        return Array.from(this.#items);
      }
    }`,
    `class Data {
      #value: number = 0;
      get value(): number {
        return this.#value;
      }
    }`,
    `class Wrapper {
      #data = new Map<string, number>();
      get data(): ReadonlyMap<string, number> {
        return this.#data;
      }
    }`,
    `class Example {
      get items(): string | number {
        return "hello";
      }
    }`,
    `class NoAnnotation {
      #items = new Set<string>();
      get items() {
        return this.#items;
      }
    }`,
    `class Example {
      #data: Array<string> = [];
      get data(): ReadonlyArray<string> {
        return this.#data;
      }
    }`,
  ],
  invalid: [
    {
      code: `class ShoppingCart {
        #items = new Set<string>();
        get items(): Set<string> {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class ShoppingCart {
        #items = new Map<string, number>();
        get items(): Map<string, number> {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Store {
        #data: string[] = [];
        get data(): string[] {
          return this.#data;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Example {
        #data: Array<string> = [];
        get data(): Array<string> {
          return this.#data;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Config {
        #settings = {};
        get settings(): { name: string; value: number } {
          return this.#settings;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Mixed {
        #state: string | Set<string> = new Set();
        get state(): string | Set<string> {
          return this.#state;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Qualified {
        #items = new Set();
        get items(): Collections.Set<string> {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class Parenthesized {
        #items = new Set();
        get items(): (Set<string>) {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class WithIntersection {
        #items = new Set();
        get items(): Set<string> & { readonly tag: string } {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `abstract class AbstractGetter {
        abstract get items(): Set<string>;
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
    {
      code: `class QuotedKey {
        #items = new Set();
        get "items"(): Set<string> {
          return this.#items;
        }
      }`,
      errors: [{ messageId: "mutableGetterReturn" }],
    },
  ],
});
