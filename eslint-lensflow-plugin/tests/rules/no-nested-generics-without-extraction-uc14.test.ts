import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-generics-without-extraction-uc14.js";

ruleTester.run("no-nested-generics-without-extraction-uc14", rule, {
  valid: [
    // Only one method returns the self-referencing generic type — below threshold
    `interface Result<T, E> {
      map<U>(f: (t: T) => U): Result<U, E>;
    }`,
    // Interface has no type parameters — rule does not apply
    `interface Simple {
      foo(): Simple;
      bar(): Simple;
    }`,
    // Methods return other types, not the enclosing interface
    `interface Processor<T> {
      run(): void;
      result(): T;
    }`,
    // Two methods but neither returns the self-referencing type
    `interface Ok<T, E> {
      map<U>(f: (t: T) => U): Ok<U, E>;
      toString(): string;
    }`,
    // Property signature with function type — only one self-referencing
    `interface Chain<T> {
      then<U>(fn: (t: T) => U): Chain<U>;
    }`,
    // TSQualifiedName: qualified return type, only one self-referencing — below threshold
    `interface Result<T, E> {
      map<U>(f: (t: T) => U): NS_NS.Result<U, E>;
    }`,
    // Raised threshold: 2 self-referencing methods but minSelfReferencingMethods set to 3
    {
      code: `interface Result<T, E> {
        map<U>(f: (t: T) => U): Result<U, E>;
        flatMap<U>(f: (t: T) => Result<U, E>): Result<U, E>;
      }`,
      options: [{ minSelfReferencingMethods: 3 }],
    },
  ],
  invalid: [
    // Antipattern: multiple methods return the same interface with substituted generics
    {
      code: `interface Result<T, E> {
        map<U>(f: (t: T) => U): Result<U, E>;
        flatMap<U>(f: (t: T) => Result<U, E>): Result<U, E>;
      }`,
      errors: [{ messageId: "selfReferencingMethods" }],
    },
    // Three self-referencing methods
    {
      code: `interface Either<L, R> {
        map<U>(f: (r: R) => U): Either<L, U>;
        flatMap<U>(f: (r: R) => Either<L, U>): Either<L, U>;
        bimap<A, B>(f: (l: L) => A, g: (r: R) => B): Either<A, B>;
      }`,
      errors: [{ messageId: "selfReferencingMethods" }],
    },
    // Mix of TSMethodSignature and TSPropertySignature with TSFunctionType
    {
      code: `interface Task<T, E> {
      map<U>(f: (t: T) => U): Task<U, E>;
      chain: <U>(f: (t: T) => Task<U, E>) => Task<U, E>;
    }`,
      errors: [{ messageId: "selfReferencingMethods" }],
    },
    // TSQualifiedName: qualified return type with multiple self-referencing methods
    {
      code: `interface Result<T, E> {
        map<U>(f: (t: T) => U): NS_NS.Result<U, E>;
        chain<U>(f: (t: T) => NS_NS.Result<U, E>): NS_NS.Result<U, E>;
      }`,
      errors: [{ messageId: "selfReferencingMethods" }],
    },
    // Raised threshold: 3 self-referencing methods with minSelfReferencingMethods set to 3
    {
      code: `interface Either<L, R> {
        map<U>(f: (r: R) => U): Either<L, U>;
        flatMap<U>(f: (r: R) => Either<L, U>): Either<L, U>;
        bimap<A, B>(f: (l: L) => A, g: (r: R) => B): Either<A, B>;
      }`,
      options: [{ minSelfReferencingMethods: 3 }],
      errors: [{ messageId: "selfReferencingMethods" }],
    },
  ],
});
