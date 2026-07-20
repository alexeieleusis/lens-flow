import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-contravariance-over-union-uc17.js";

ruleTester.run("prefer-contravariance-over-union-uc17", rule, {
  valid: [
    `interface Handler<in T> {
      handle: (v: T) => void;
    }`,
    `interface SmallUnion {
      handle: (v: Cat | Dog) => void;
    }`,
    `type Fine = {
      process: (x: string | number) => void;
    };`,
    `interface Handler {
      handle: (v: Cat) => void;
    }`,
    {
      code: `interface Handler {
        handle: (v: Cat | Dog | Animal) => void;
      }`,
      options: [{ minUnionMembers: 5 }],
    },
    {
      code: `interface Handler {
        handle: (v: Cat | Dog | Animal) => void;
      }`,
      options: [{}],
    },
  ],
  invalid: [
    {
      code: `interface Handler {
        handle: (v: Cat | Dog | Animal) => void;
      }`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `type EventProcessor = {
        process: (event: ClickEvent | KeyEvent | ScrollEvent) => void;
      };`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `interface MultiHandler {
        handle: (x: A | B | C | D) => void;
      }`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `interface Handler {
        handle: (v: Cat | Dog) => void;
      }`,
      options: [{ minUnionMembers: 2 }],
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `interface Handler {
        handle: (v: NS.Cat | NS.Dog | NS.Animal) => void;
      }`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `type MixedHandler = {
        process: (x: string | number | boolean | Cat) => void;
      };`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `interface Handler {
        handle: (v: (Cat | Dog | Animal)) => void;
      }`,
      errors: [{ messageId: "preferContravariance" }],
    },
    {
      code: `type EventProcessor = {
        process: (event: (ClickEvent | KeyEvent | ScrollEvent)) => void;
      };`,
      errors: [{ messageId: "preferContravariance" }],
    },
  ],
});
