import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-variance-annotation-uc17.js";

ruleTester.run("require-variance-annotation-uc17", rule, {
  valid: [
    // Type parameter used in both input and output — invariant, no annotation needed
    `interface Processor<T, U> {
      process(input: T, outputFormat: U): T;
      convert(input: U): U;
    }`,
    // Already has \`in\` annotation
    `interface Processor<T, in U> {
      process(input: T, outputFormat: U): T;
    }`,
    // Already has \`out\` annotation
    `interface Producer<out T> {
      produce(input: string): T;
    }`,
    // Type parameter not used in any method
    `interface Container<T> {
      size(): number;
    }`,
    // Type alias with already annotated parameter
    `type Sink<in T> = {
      consume(value: T): void;
    };`,
    // T used in both input and output via property function type
    `interface Handler<T> {
      handle: (input: T) => T;
    }`,
  ],
  invalid: [
    // U only in input position — from antipattern_snippet
    {
      code: `interface Processor<T, U> {
        process(input: T, outputFormat: U): T;
      }`,
      errors: [{ messageId: "suggestIn" }],
    },
    // T only in output position
    {
      code: `interface Producer<T> {
        produce(input: string): T;
      }`,
      errors: [{ messageId: "suggestOut" }],
    },
    // Type alias: U only in input position
    {
      code: `type Processor<T, U> = {
        process(input: T, outputFormat: U): T;
      };`,
      errors: [{ messageId: "suggestIn" }],
    },
    // Type alias: T only in output position
    {
      code: `type Producer<T> = {
        produce(input: string): T;
      };`,
      errors: [{ messageId: "suggestOut" }],
    },
    // Property with function type: U only in input, T only in output
    {
      code: `interface Consumer<T, U> {
        accept: (value: U) => T;
      }`,
      errors: [
        { messageId: "suggestOut" },
        { messageId: "suggestIn" },
      ],
    },
  ],
});
