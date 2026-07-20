import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-call-signature-leaked-internals.js";

ruleTester.run("no-call-signature-leaked-internals", rule, {
  valid: [
    `interface Repository extends Cacheable {
      (id: number, options: { withSoftDeletes: boolean }): Promise<Entity>;
    }
    interface Cacheable extends Map<number, Entity> {}`,
    `interface Fine {
      name: string;
      _cache: Map<string, unknown>;
    }`,
    `interface Callable {
      (id: number): Promise<void>;
    }`,
  ],
  invalid: [
    {
      code: `interface Repository {
        (id: number, options: { withSoftDeletes: boolean }): Promise<Entity>;
        readonly _cache: Map<number, Entity>;
      }`,
      errors: [{ messageId: "leakedInternals" }],
    },
    {
      code: `interface Store {
        (key: string): unknown;
        _state: Record<string, unknown>;
        _listeners: Set<() => void>;
      }`,
      errors: [{ messageId: "leakedInternals" }],
    },
    {
      code: `interface Store {
        (key: string): unknown;
        "_cache": Map<string, unknown>;
      }`,
      errors: [{ messageId: "leakedInternals" }],
    },
    {
      code: `type Repository = {
        (id: number): Promise<void>;
        _cache: Map<string, unknown>;
      }`,
      errors: [{ messageId: "leakedInternals" }],
    },
  ],
});
