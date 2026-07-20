import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-bivariant-method-syntax.js";

ruleTester.run("no-bivariant-method-syntax", rule, {
  valid: [
    `interface ContravariantHandler {
      handle: (x: Dog) => void;
    }`,
    `type SafeHandler = {
      process: (data: string, id: number) => boolean;
    }`,
    `interface Mixed {
      safe: (x: number) => void;
      count: number;
    }`,
    `type Empty = {}`,
  ],
  invalid: [
    {
      code: `interface BivariantHandler {
        handle(x: Dog): void;
      }`,
      errors: [{ messageId: "methodSyntax" }],
    },
    {
      code: `type BivariantHandler = {
        handle(x: Dog): void;
      }`,
      errors: [{ messageId: "methodSyntax" }],
    },
    {
      code: `interface Service {
        process(data: string, id: number): boolean;
      }`,
      errors: [{ messageId: "methodSyntax" }],
    },
    {
      code: `interface BivariantHandler {
        handle(x: Dog): void;
        parse(y: string): number;
      }`,
      errors: [{ messageId: "methodSyntax" }, { messageId: "methodSyntax" }],
    },
    {
      code: `type Multi = {
        a(x: number): void;
        b: (y: string) => void;
        c(z: boolean): number;
      }`,
      errors: [{ messageId: "methodSyntax" }, { messageId: "methodSyntax" }],
    },
    {
      code: `interface QuotedKey {
        "handle"(x: Dog): void;
      }`,
      errors: [{ messageId: "methodSyntax" }],
    },
  ],
});
