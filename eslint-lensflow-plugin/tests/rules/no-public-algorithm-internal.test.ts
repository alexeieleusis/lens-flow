import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-public-algorithm-internal.js";

ruleTester.run("no-public-algorithm-internal", rule, {
  valid: [
    // Private field with # prefix — not public
    `class Sorter {
      #buffer: number[] = [];
      sort(nums: number[]) {
        this.#buffer.push(...nums);
        return this.#buffer;
      }
    }`,
    // Name doesn't match pattern
    `class Processor {
      data: number[] = [];
      process(nums: number[]) {
        this.data.push(...nums);
        return this.data;
      }
    }`,
    // Name matches but type is not a collection
    `class Worker {
      cache: string = "default";
      getCache() {
        return this.cache;
      }
    }`,
    // Name matches and type matches but no method accesses it via this
    `class Container {
      buffer: number[] = [];
    }`,
    // Protected field should be skipped
    `class Base {
      protected buffer: number[] = [];
      sort(nums: number[]) {
        this.buffer.push(...nums);
        return this.buffer;
      }
    }`,
    // Public field with matching name but type is a primitive
    `class Config {
      state: string = "idle";
      getState() {
        return this.state;
      }
    }`,
  ],
  invalid: [
    // Classic example: public buffer accessed by method
    {
      code: `class Sorter {
        buffer: number[] = [];
        sort(nums: number[]) {
          this.buffer.push(...nums);
          this.buffer.sort();
          return this.buffer;
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // Public cache of type Map accessed by method
    {
      code: `class Fetcher {
        cache: Map<string, number> = new Map();
        get(key: string) {
          return this.cache.get(key);
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // Public accumulator of type Set
    {
      code: `class Collector {
        accumulator: Set<number> = new Set();
        add(n: number) {
          this.accumulator.add(n);
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // Public state as TSTypeLiteral
    {
      code: `class Machine {
        state: { step: number; done: boolean } = { step: 0, done: false };
        tick() {
          this.state.step++;
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // Multiple matching fields in one class
    {
      code: `class Engine {
        buffer: number[] = [];
        cache: Map<string, number> = new Map();
        run(nums: number[]) {
          this.buffer.push(...nums);
          this.cache.set("count", nums.length);
        }
      }`,
      errors: [
        { messageId: "publicInternalState" },
        { messageId: "publicInternalState" },
      ],
    },
    // _internal with array type
    {
      code: `class Processor {
        _internal: number[] = [];
        process(data: number[]) {
          this._internal.push(...data);
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // _pool with array type
    {
      code: `class PoolManager {
        _pool: number[] = [];
        acquire() {
          return this._pool.pop();
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
    // Class-field arrow function accessing internal property
    {
      code: `class Sorter {
        buffer: number[] = [];
        sort = (nums: number[]) => {
          this.buffer.push(...nums);
          return this.buffer;
        }
      }`,
      errors: [{ messageId: "publicInternalState" }],
    },
  ],
});
