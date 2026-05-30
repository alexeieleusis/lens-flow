import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-fat-interface.js";

ruleTester.run("no-fat-interface", rule, {
  valid: [
    // Interface under default limit of 5
    `interface User {
      id: string;
      name: string;
      email: string;
      age: number;
    }`,
    // Interface under the limit
    `interface Point {
      x: number;
      y: number;
    }`,
    // Empty interface
    `interface Empty {}`,
    // Interfaces only count property/method signatures, not index signatures
    `interface WithIndex {
      a: string;
      b: string;
      c: string;
      d: string;
      [key: string]: unknown;
    }`,
    // Custom maxMembers option
    {
      code: `interface Big {
        a: string;
        b: string;
        c: string;
        d: string;
        e: string;
        f: string;
      }`,
      options: [{ maxMembers: 10 }],
    },
    // Method signatures count toward the total
    `interface Service {
      id: string;
      get(): void;
      set(v: string): void;
      delete(): void;
    }`,
  ],
  invalid: [
    // Interface exceeding default limit of 5
    {
      code: `interface Fat {
        a: string;
        b: string;
        c: string;
        d: string;
        e: string;
        f: string;
      }`,
      errors: [
        {
          messageId: "tooManyMembers",
          data: { name: "Fat", count: "6", max: "5" },
        },
      ],
    },
    // Mix of property and method signatures
    {
      code: `interface Mixed {
        id: string;
        name: string;
        greet(): void;
        farewell(): void;
        age: number;
        birthdate: Date;
      }`,
      errors: [
        {
          messageId: "tooManyMembers",
          data: { name: "Mixed", count: "6", max: "5" },
        },
      ],
    },
    // Call and construct signatures count
    {
      code: `interface Factory {
        a: string;
        b: string;
        c: string;
        d: string;
        (): void;
        new (): Factory;
      }`,
      errors: [
        {
          messageId: "tooManyMembers",
          data: { name: "Factory", count: "6", max: "5" },
        },
      ],
    },
    // Custom maxMembers option triggers earlier
    {
      code: `interface Small {
        a: string;
        b: string;
        c: string;
      }`,
      options: [{ maxMembers: 2 }],
      errors: [
        {
          messageId: "tooManyMembers",
          data: { name: "Small", count: "3", max: "2" },
        },
      ],
    },
    // Exactly at the limit triggers the rule (>=)
    {
      code: `interface Exact {
        a: string;
        b: string;
        c: string;
        d: string;
        e: string;
      }`,
      errors: [
        {
          messageId: "tooManyMembers",
          data: { name: "Exact", count: "5", max: "5" },
        },
      ],
    },
  ],
});
