import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-function-property-over-method.js";

ruleTester.run("prefer-function-property-over-method", rule, {
  valid: [
    `interface ContravariantBox<T> {
      fn: (arg: T) => void;
    }`,
    `interface NonGeneric {
      method(arg: string): void;
    }`,
    `interface NonGeneric<T> {
      method(arg: string): void;
    }`,
    `interface GenericNoUsage<T> {
      value: T;
    }`,
    `interface GenericWithNonRefMethod<T> {
      method(arg: number): void;
    }`,
  ],
  invalid: [
    {
      code: `interface BivariantBox<T> {
        method(arg: T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Handler<T, U> {
        handle(input: T, output: U): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Processor<T> {
        process(item: Array<T>): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Transformer<T> {
        transform(value: T | null): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    {
      code: `interface Foo<T> {
        "process"(item: T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Qualified type param reference (TSQualifiedName)
    {
      code: `interface Foo<T> {
        method(arg: NS.T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Nested qualified type param reference
    {
      code: `interface Foo<T> {
        method(arg: A.B.C.T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Function type param (TSFunctionType)
    {
      code: `interface Foo<T> {
        method(cb: (x: T) => void): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Function type with return referencing type param
    {
      code: `interface Foo<T> {
        method(cb: () => T): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Constructor type (TSConstructorType)
    {
      code: `interface Foo<T> {
        method(ctor: new (x: T) => any): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Conditional type (TSConditionalType)
    {
      code: `interface Foo<T> {
        method(arg: T extends string ? T : never): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Indexed access type (TSIndexedAccessType)
    {
      code: `interface Foo<T> {
        method(arg: T[keyof T]): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Mapped type (TSMappedType)
    {
      code: `interface Foo<T> {
        method(arg: { [K in keyof T]: T[K] }): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
    // Tuple type (TSTupleType)
    {
      code: `interface Foo<T> {
        method(arg: [T, T]): void;
      }`,
      errors: [{ messageId: "preferFunctionProperty" }],
    },
  ],
});
