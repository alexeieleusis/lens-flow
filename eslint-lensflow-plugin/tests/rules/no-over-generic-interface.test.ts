import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-over-generic-interface.js";

ruleTester.run("no-over-generic-interface", rule, {
  valid: [
    `interface UserRepo {
      get(id: string): User | null;
      save(user: User): void;
    }`,
    `interface Repo<T, K> {
      get(id: K): T | null;
      save(value: T): K;
    }`,
    {
      code: `interface Repo<T, K, O> {
        get(id: K): T | null;
        save(o: O): K;
      }`,
      options: [{ maxTypeParams: 4 }],
    },
  ],
  invalid: [
    {
      code: `interface Repo<T, K, O extends T & Record<string, K>> {
        get(id: K): T | null;
        save(o: O): K;
      }`,
      errors: [{ messageId: "tooManyTypeParams" }],
    },
    {
      code: `interface Mapper<A, B, C, D> {
        map(a: A, b: B): [C, D];
      }`,
      errors: [{ messageId: "tooManyTypeParams" }],
    },
    {
      code: `interface Quad<T1, T2, T3, T4, T5> {
        run(): void;
      }`,
      errors: [{ messageId: "tooManyTypeParams" }],
    },
    {
      code: `interface Repo<T, K> {
        get(id: K): T | null;
      }`,
      options: [{ maxTypeParams: 1 }],
      errors: [{ messageId: "tooManyTypeParams" }],
    },
  ],
});
