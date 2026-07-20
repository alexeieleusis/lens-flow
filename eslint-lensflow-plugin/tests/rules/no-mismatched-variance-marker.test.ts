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
    // in T in function property params — correct
    `interface FnConsumer<in T> {
      handler: (t: T) => void;
    }`,
    // Multiple params, one covariant one contravariant
    `interface Bimap<out R, in S> {
      map(fn: (s: S) => void): R;
    }`,
    // out T in callable interface return — correct
    `interface Callable<out T> {
      (): T;
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
    // out T in parenthesized return type — correct
    `interface ParenOut<out T> {
      getValue(): (T);
    }`,
    // in T in parenthesized parameter type — correct
    `interface ParenIn<in T> {
      setValue(t: (T)): void;
    }`,
    // out T in conditional type true/false branches (output position) — correct
    `interface ConditionalOut<out T> {
      getValue(): T extends string ? T : never;
    }`,
    // out T in mapped type annotation (output position) — correct
    `interface MappedOut<out T> {
      prop: { [K in string]: T };
    }`,
    // in T in conditional type checkType (input position) — correct
    `interface ConditionalIn<in T> {
      fn(x: T extends string ? number : boolean): void;
    }`,
    // in T in mapped type annotation (input position) — correct
    `interface MappedIn<in T> {
      fn(x: { [K in string]: T }): void;
    }`,
    // in T in constructor type params (input position) — correct
    `interface ConstructorIn<in T> {
      create: new (t: T) => void;
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
    // out T in nested type literal property — mismatch
    {
      code: `interface Bad<out T> {
        inner: {
          process(t: T): void;
        };
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // out T used in array param — mismatch
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
    // in T in index signature return type — mismatch
    {
      code: `interface Bad<in T> {
        [key: string]: T;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // in T in index signature with number key — mismatch
    {
      code: `interface Bad<in T> {
        [index: number]: T;
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
    // out T in index signature parameter — mismatch
    {
      code: `interface Mapped<out T> {
        [key: T]: string;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // out T in parenthesized parameter type — mismatch
    {
      code: `interface Bad<out T> {
        setValue(t: (T)): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T in parenthesized return type — mismatch
    {
      code: `interface Bad<in T> {
        getValue(): (T);
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in conditional type true/false branches in param position — mismatch
    {
      code: `interface Bad<out T> {
        fn(x: string extends number ? T : never): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T in conditional type true branch in return position — mismatch
    {
      code: `interface Bad<in T> {
        getValue(): string extends number ? T : never;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in mapped type annotation in param position — mismatch
    {
      code: `interface Bad<out T> {
        fn(x: { [K in string]: T }): void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T in mapped type annotation in return position — mismatch
    {
      code: `interface Bad<in T> {
        getValue(): { [K in string]: T };
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
    // out T in constructor type params (input position) — mismatch
    {
      code: `interface Bad<out T> {
        create: new (t: T) => void;
      }`,
      errors: [{ messageId: "outInInputPosition" }],
    },
    // in T in constructor type return type (output position) — mismatch
    {
      code: `interface Bad<in T> {
        create: new () => T;
      }`,
      errors: [{ messageId: "inInOutputPosition" }],
    },
  ],
});
