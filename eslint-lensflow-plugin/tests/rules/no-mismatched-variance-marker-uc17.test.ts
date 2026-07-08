import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mismatched-variance-marker-uc17.js";

ruleTester.run("no-mismatched-variance-marker-uc17", rule, {
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
    `interface ReaderWriter<in out T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // Split into read/write interfaces — correct
    `interface Reader<out T> {
      getData(): T;
    }
    interface Writer<in T> {
      setData(v: T): void;
    }`,
    // No variance marker — always valid
    `interface Generic<T> {
      getValue(): T;
      setValue(t: T): void;
    }`,
    // out T with array in return — correct
    `interface Container<out T> {
      get(): Array<T>;
    }`,
    // in T with array in param — correct
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
    // out T in function property return type — correct
    `interface FnProducer<out T> {
      factory: () => T;
    }`,
    // in T in function property params — correct
    `interface FnConsumer<in T> {
      handler: (t: T) => void;
    }`,
    // Multiple params, correct variance each
    `interface Bimap<out R, in S> {
      map(fn: (s: S) => void): R;
    }`,
    // out T in callable interface return — correct
    `interface Callable<out T> {
      (): T;
    }`,
  ],
  invalid: [
    // out T used as method parameter — mismatch
    {
      code: `interface Container<out T> {
        getData(): T;
        setData(v: T): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T used as return type — mismatch
    {
      code: `interface Source<in T> {
        getValue(): T;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in function property params — mismatch
    {
      code: `interface Sink<out T> {
        handler: (t: T) => void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T in function property return type — mismatch
    {
      code: `interface Factory<in T> {
        create: () => T;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // Type alias: out T used as parameter — mismatch
    {
      code: `type BadContainer<out T> = {
        setValue(t: T): void;
      };`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // Type alias: in T used as return — mismatch
    {
      code: `type BadSource<in T> = {
        getValue(): T;
      };`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in array param — mismatch
    {
      code: `interface Bad<out T> {
        setItems(items: T[]): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T used in plain property type (output position) — mismatch
    {
      code: `interface Bad<in T> {
        result: T;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in callable interface params — mismatch
    {
      code: `interface Callable<out T> {
        (t: T): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
  ],
});
