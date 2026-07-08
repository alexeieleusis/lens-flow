import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mismatched-variance-marker.js";

ruleTester.run("no-mismatched-variance-marker", rule, {
  valid: [
    // out T used only in return position — correct
    `interface Producer<out T> {
      getValue(): T;
    }`,
    // in T used only in parameter position — correct
    `interface Consumer<in T> {
      setValue(t: T): void;
    }`,
    // in out T used in both positions — correct
    `interface Correct<in out T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // No variance marker — always valid
    `interface Generic<T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // out T in nested return type — correct
    `interface NestedOut<out T> {
      getFn(): () => T;
    }`,
    // in T in nested function param — correct
    `interface NestedIn<in T> {
      fn: (t: T) => void;
    }`,
    // out T with type arguments in return — correct
    `interface Container<out T> {
      get(): Array<T>;
    }`,
    // in T with type arguments in param — correct
    `interface ContainerIn<in T> {
      set(item: Array<T>): void;
    }`,
    // Type alias with correct variance
    `type ProducerAlias<out T> = {
      getValue(): T;
    };`,
    // Type alias with in variance used correctly
    `type ConsumerAlias<in T> = {
      setValue(t: T): void;
    };`,
    // out T used in property of function return type (output position) — correct
    `interface FnProducer<out T> {
      factory: () => T;
    }`,
    // Multiple params, one covariant one contravariant
    `interface Bimap<out R, in S> {
      map(fn: (s: S) => void): R;
    }`,
    // out T in index signature return type — correct
    `interface Map<out T> {
      [key: string]: T;
    }`,
    // out T in numeric index signature return type — correct
    `interface NumericMap<out T> {
      [index: number]: T;
    }`,
    // Type alias: out T in index signature — correct
    `type MapAlias<out T> = {
      [key: string]: T;
    };`,
  ],
  invalid: [
    // out T used as method parameter — mismatch
    {
      code: `interface Bad<out T> {
        setValue(t: T): void;
      }`,
      errors: [{ messageId: "outUsedAsInput" }],
    },
    // in T used as return type — mismatch
    {
      code: `interface Bad<in T> {
        getValue(): T;
      }`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
    // out T in function property params — mismatch
    {
      code: `interface Bad<out T> {
        handler: (t: T) => void;
      }`,
      errors: [{ messageId: "outUsedAsInput" }],
    },
    // in T in function property return type — mismatch
    {
      code: `interface Bad<in T> {
        factory: () => T;
      }`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
    // Type alias: out T used as parameter — mismatch
    {
      code: `type Bad<out T> = {
        setValue(t: T): void;
      };`,
      errors: [{ messageId: "outUsedAsInput" }],
    },
    // Type alias: in T used as return — mismatch
    {
      code: `type Bad<in T> = {
        getValue(): T;
      };`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
    // out T in nested type literal property — mismatch
    {
      code: `interface Bad<out T> {
        inner: {
          process(t: T): void;
        };
      }`,
      errors: [{ messageId: "outUsedAsInput" }],
    },
    // out T used in array param — mismatch
    {
      code: `interface Bad<out T> {
        setItems(items: T[]): void;
      }`,
      errors: [{ messageId: "outUsedAsInput" }],
    },
    // in T used in property return type — mismatch
    {
      code: `interface Bad<in T> {
        result: T;
      }`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
    // in T in index signature return type — mismatch
    {
      code: `interface Bad<in T> {
        [key: string]: T;
      }`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
    // in T in index signature with number key — mismatch
    {
      code: `interface Bad<in T> {
        [index: number]: T;
      }`,
      errors: [{ messageId: "inUsedAsOutput" }],
    },
  ],
});
