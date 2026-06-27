import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-concrete-type-bound.js";

ruleTester.run("no-concrete-type-bound", rule, {
  valid: [
    // Structural constraint is fine
    `function save<T extends { id: string; createdAt: Date }>(x: T) {
      return x;
    }`,
    // No constraint at all is fine
    `function identity<T>(x: T): T {
      return x;
    }`,
    // Built-in reference: Error
    `function handleError<T extends Error>(e: T) {
      console.error(e);
    }`,
    // Built-in reference: Object
    `function clone<T extends Object>(o: T): T {
      return Object.assign({}, o);
    }`,
    // Built-in reference: Record
    `function getKeys<T extends Record<string, unknown>>(r: T) {
      return Object.keys(r);
    }`,
    // Union of structural types
    `function process<T extends { id: string } | { name: string }>(x: T) {
      return x;
    }`,
    // Allowed via config option
    {
      code: `function save<T extends User>(x: T) {
        return x;
      }`,
      options: [{ allowedReferences: ["User"] }],
    },
  ],
  invalid: [
    // Concrete named type constraint
    {
      code: `function save<T extends User>(x: T) {
        db.insert(x);
      }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Another concrete type
    {
      code: `class Repository<T extends BaseModel> {
        save(x: T) {
          return x;
        }
      }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Multiple type parameters, only one violates
    {
      code: `function merge<T extends { id: string }, U extends Employee>(a: T, b: U) {
        return { ...a, ...b };
      }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Concrete type with generics in constraint is still a TSTypeReference
    {
      code: `function wrap<T extends Promise<string>>(x: T) {
        return x;
      }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Namespaced (TSQualifiedName) concrete type constraint
    {
      code: `function handle<T extends TE.User>(x: T) { return x; }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Union containing a concrete type
    {
      code: `function process<T extends User | Admin>(x: T) { return x; }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Intersection containing a concrete type
    {
      code: `function process<T extends User & Loggable>(x: T) { return x; }`,
      errors: [{ messageId: "concreteBound" }],
    },
    // Parenthesized concrete type
    {
      code: `function process<T extends (User)>(x: T) { return x; }`,
      errors: [{ messageId: "concreteBound" }],
    },
  ],
});
