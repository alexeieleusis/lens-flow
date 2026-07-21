import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-variance-annotation-uc17.js";

// This rule is a deprecated alias of `require-explicit-variance`.
// Tests mirror the base rule to verify the re-export works correctly.
ruleTester.run(
  "require-variance-annotation-uc17 (alias of require-explicit-variance)",
  rule,
  {
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
        errors: [{ messageId: "suggestOut" }, { messageId: "suggestIn" }],
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
      // Property with direct type reference — covariant
      {
        code: `interface Holder<T> {
        value: T;
      }`,
        errors: [{ messageId: "suggestOut" }],
      },
      // Call signature: T only in return position — covariant
      {
        code: `interface Factory<T> {
        (): T;
      }`,
        errors: [{ messageId: "suggestOut" }],
      },
      // T inside a union in parameter position — contravariant, suggest `in`
      {
        code: `interface Handler<T> {
        process(input: T | string): void;
      }`,
        errors: [{ messageId: "suggestIn" }],
      },
      // T inside an intersection in return position — covariant, suggest `out`
      {
        code: `interface Result<T> {
        data(): T & { meta: string };
      }`,
        errors: [{ messageId: "suggestOut" }],
      },
    ],
  },
);
