import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unnecessary-invariance.js";

ruleTester.run("no-unnecessary-invariance", rule, {
  valid: [
    // in out T used in both positions — invariant is correct
    `interface Correct<in out T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // out T used only in return position — correct
    `interface Producer<out T> {
      getValue(): T;
    }`,
    // in T used only in parameter position — correct
    `interface Consumer<in T> {
      setValue(t: T): void;
    }`,
    // No variance marker — always valid
    `interface Generic<T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // Type alias with correct in out variance
    `type CorrectAlias<in out T> = {
      getValue(): T;
      setValue(t: T): void;
    };`,
    // Multiple type params, only one flagged
    `interface Multi<in out T, S> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // in out with function property in both positions
    `interface Handler<in out T> {
      process: (input: T) => T;
    }`,
    // in out with callable signature in both positions — correct
    `interface Callable<in out T> {
      (t: T): T;
    }`,
  ],
  invalid: [
    // in out T used only in return position — should be out
    {
      code: `interface UnnecessaryInvariant<in out T> {
        getValue(): T;
      }`,
      errors: [{ messageId: "onlyOutput" }],
    },
    // in out T used only in parameter position — should be in
    {
      code: `interface OnlyInput<in out T> {
        setValue(t: T): void;
      }`,
      errors: [{ messageId: "onlyInput" }],
    },
    // Type alias: in out T only in return — should be out
    {
      code: `type UnnecessaryInvariantAlias<in out T> = {
        getValue(): T;
      };`,
      errors: [{ messageId: "onlyOutput" }],
    },
    // Type alias: in out T only in params — should be in
    {
      code: `type OnlyInputAlias<in out T> = {
        setValue(t: T): void;
      };`,
      errors: [{ messageId: "onlyInput" }],
    },
    // in out with function property return only
    {
      code: `interface FnProducer<in out T> {
        factory: () => T;
      }`,
      errors: [{ messageId: "onlyOutput" }],
    },
    // in out with function property params only
    {
      code: `interface FnConsumer<in out T> {
        handler: (t: T) => void;
      }`,
      errors: [{ messageId: "onlyInput" }],
    },
    // in out with nested Array return type
    {
      code: `interface ArrayProducer<in out T> {
        get(): Array<T>;
      }`,
      errors: [{ messageId: "onlyOutput" }],
    },
    // in out with nested Array param
    {
      code: `interface ArrayConsumer<in out T> {
        setItems(items: T[]): void;
      }`,
      errors: [{ messageId: "onlyInput" }],
    },
    // in out with callable signature return only — should be out
    {
      code: `interface CallableProducer<in out T> {
        (x: number): T;
      }`,
      errors: [{ messageId: "onlyOutput" }],
    },
    // in out with callable signature params only — should be in
    {
      code: `interface CallableConsumer<in out T> {
        (t: T): void;
      }`,
      errors: [{ messageId: "onlyInput" }],
    },
  ],
});
