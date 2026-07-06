import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-explicit-variance.js";

ruleTester.run("require-explicit-variance", rule, {
  valid: [
    // Type parameter appears in both input and output positions — no variance suggestion needed
    `interface Processor<T> {
      process(item: T): T;
    }`,
    // No type parameters — nothing to check
    `interface NoGenerics {
      value: string;
    }`,
    // Already annotated with `out` — should not trigger
    `interface Producer<out T> {
      produce(): T;
    }`,
    // Already annotated with `in` — should not trigger
    `interface Consumer<in T> {
      consume(item: T): void;
    }`,
    // Type parameter appears in both positions — invariant, no annotation needed
    `interface Store<T> {
      get(): T;
      set(value: T): void;
    }`,
    // Mutable property — invariant position (both read and write), no annotation needed
    `interface Wrapper<T> {
      value: T;
    }`,
    // Type alias with no type parameters
    `type SimpleAlias = string;`,
  ],
  invalid: [
    // T only in return position — covariant, suggest `out`
    {
      code: `interface Producer<T> {
        produce(): T;
      }`,
      errors: [{ messageId: "suggestOut" }],
    },
    // T only in parameter position — contravariant, suggest `in`
    {
      code: `interface Consumer<T> {
        consume(item: T): void;
      }`,
      errors: [{ messageId: "suggestIn" }],
    },
    // Type alias: T only in parameter position of arrow function
    {
      code: `type Consumer<T> = (item: T) => void;`,
      errors: [{ messageId: "suggestIn" }],
    },
    // Type alias: T only in return position of arrow function
    {
      code: `type Producer<T> = () => T;`,
      errors: [{ messageId: "suggestOut" }],
    },
    // Multiple type parameters: first covariant, second contravariant
    {
      code: `interface Mapper<A, B> {
        map(input: B): A;
      }`,
      errors: [
        { messageId: "suggestOut" },
        { messageId: "suggestIn" },
      ],
    },
    // T in array of return types — still covariant
    {
      code: `interface BatchProducer<T> {
        produce(): T[];
      }`,
      errors: [{ messageId: "suggestOut" }],
    },
    // T in tuple parameter — contravariant
    {
      code: `interface TupleConsumer<T> {
        accept(pair: [T, string]): void;
      }`,
      errors: [{ messageId: "suggestIn" }],
    },
    // Readonly property — T is purely covariant, suggest `out`
    {
      code: `interface ReadonlyWrapper<T> {
        readonly value: T;
      }`,
      errors: [{ messageId: "suggestOut" }],
    },
    // T wrapped in parentheses (TSParenthesizedType) in return position — covariant, suggest `out`
    {
      code: `interface Producer<T> {
        produce(): (T);
      }`,
      errors: [{ messageId: "suggestOut" }],
    },
  ],
});
