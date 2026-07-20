import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-covariant-container-mutation-uc17.js";

ruleTester.run("no-covariant-container-mutation-uc17", rule, {
  valid: [
    // Purely covariant — no mutation methods
    `interface ReadOnlyBox<out T> {
      value: T;
      get(): T;
    }`,
    // Invariant (in out) — mutation is allowed
    `interface MutableBox<in out T> {
      get(): T;
      set(v: T): void;
    }`,
    // Contravariant — not flagged by this rule
    `interface Writer<in T> {
      write(v: T): void;
    }`,
    // No variance annotation — not flagged
    `interface Box<T> {
      setValue(v: T): void;
    }`,
    // Two separate interfaces — correct pattern
    `interface ReadOnlyBox<out T> { get(): T; }
    interface WriteOnlyBox<in T> { set(v: T): void; }`,
    // Method only uses a different type param, not the covariant one
    `interface Box<out T, U> {
      value: T;
      process(item: U): void;
    }`,
    // Property is not a function type — just output position
    `interface Box<out T> {
      value: T;
    }`,
    // Multiple covariant — no method accepts a covariant type param
    `interface Box<out T, out U> {
      value: T;
      getU(): U;
    }`,
    // Call signature returns covariant type (output position, not input)
    `interface Factory<out T> {
      (): T;
    }`,
    // Construct signature returns covariant type (output position, not input)
    `interface Constructor<out T> {
      new (): T;
    }`,
    // Call signature with non-covariant parameter
    `interface Factory<out T, U> {
      (value: U): T;
    }`,
  ],
  invalid: [
    // Setter method on covariant container
    {
      code: `interface Box<out T> {
        value: T;
        setValue(v: T): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Multiple mutation methods
    {
      code: `interface Box<out T> {
        setValue(v: T): void;
        update(v: T): void;
      }`,
      errors: [
        { messageId: "mutationOnCovariant" },
        { messageId: "mutationOnCovariant" },
      ],
    },
    // Property with function type accepting covariant type
    {
      code: `interface Box<out T> {
        handler: (x: T) => void;
      }`,
      errors: [{ messageId: "propertyMutationOnCovariant" }],
    },
    // Method with covariant type in nested generic (Array<T>)
    {
      code: `interface Box<out T> {
        setValues(items: Array<T>): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Union-wrapped covariant type parameter
    {
      code: `interface Box<out T> {
        setValue(v: T | string): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Parenthesized covariant type parameter
    {
      code: `interface Box<out T> {
        setValue(v: (T)): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Multiple type params where only one is covariant
    {
      code: `interface Box<out T, U> {
        value: T;
        process(item: U): void;
        set(v: T): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Both covariant — method accepts T
    {
      code: `interface Box<out T, out U> {
        setT(v: T): void;
      }`,
      errors: [{ messageId: "mutationOnCovariant" }],
    },
    // Call signature accepts covariant type parameter
    {
      code: `interface Factory<out T> {
        (value: T): void;
      }`,
      errors: [{ messageId: "callSignatureOnCovariant" }],
    },
    // Construct signature accepts covariant type parameter
    {
      code: `interface Constructor<out T> {
        new (value: T): T;
      }`,
      errors: [{ messageId: "constructSignatureOnCovariant" }],
    },
    // Call and construct signatures both accept covariant type parameter
    {
      code: `interface Mixed<out T> {
        (value: T): void;
        new (value: T): T;
      }`,
      errors: [
        { messageId: "callSignatureOnCovariant" },
        { messageId: "constructSignatureOnCovariant" },
      ],
    },
    // Call signature with covariant type in nested generic
    {
      code: `interface Factory<out T> {
        (items: Array<T>): void;
      }`,
      errors: [{ messageId: "callSignatureOnCovariant" }],
    },
  ],
});
