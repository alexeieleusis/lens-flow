import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mutable-getter-return.js";

ruleTester.run("no-mutable-getter-return", rule, {
  valid: [
    `class Container {
      #items: string[] = [];
      get items(): readonly string[] { return this.#items; }
    }`,
    `class Container {
      #data: Map<string, number> = new Map();
      get data(): ReadonlyMap<string, number> { return this.#data; }
    }`,
    `class Container {
      #data: Set<string> = new Set();
      get data(): ReadonlySet<string> { return this.#data; }
    }`,
    `class Container {
      #count: number = 0;
      get count(): number { return this.#count; }
    }`,
    `class Container {
      #label: string = "";
      get label(): string { return this.#label; }
    }`,
    `class Container {
      #items: string[] = [];
      get items(): ReadonlyArray<string> { return this.#items; }
    }`,
    `class Container {
      #items: Array<string> = [];
      get items(): ReadonlyArray<string> { return this.#items; }
    }`,
  ],
  invalid: [
    {
      code: `class Container {
        #items: string[] = [];
        get items(): string[] { return this.#items; }
      }`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `class Container {
        #data: Map<string, number> = new Map();
        get data(): Map<string, number> { return this.#data; }
      }`,
      errors: [{ messageId: "mutableCollection" }],
    },
    {
      code: `class Container {
        #data: Set<string> = new Set();
        get data(): Set<string> { return this.#data; }
      }`,
      errors: [{ messageId: "mutableCollection" }],
    },
    {
      code: `class Container {
        #state: { x: number; y: number } = { x: 0, y: 0 };
        get state(): { x: number; y: number } { return this.#state; }
      }`,
      errors: [{ messageId: "mutableObject" }],
    },
    {
      code: `class Container {
        #a: number[] = [];
        #b: string[] = [];
        get a(): number[] { return this.#a; }
        get b(): string[] { return this.#b; }
      }`,
      errors: [
        { messageId: "mutableArray" },
        { messageId: "mutableArray" },
      ],
    },
    {
      code: `class Container {
        #items: Array<string> = [];
        get items(): Array<string> { return this.#items; }
      }`,
      errors: [{ messageId: "mutableArray" }],
    },
  ],
});
