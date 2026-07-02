import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-property-function-signature.js";

ruleTester.run("prefer-property-function-signature", rule, {
  valid: [
    `interface Handler {
      handle: (req: Request) => void;
    }`,
    `interface Callback {
      onSuccess: (data: string) => void;
      onError: (err: Error) => void;
    }`,
    `type Handler = {
      handle(req: Request): void;
    };`,
    `class Handler {
      handle(req: Request): void {}
    }`,
    `interface Empty {}`,
  ],
  invalid: [
    {
      code: `interface Handler {
        handle(req: Request): void;
      }`,
      errors: [{ messageId: "preferPropertyFunction" }],
    },
    {
      code: `interface Callback {
        onSuccess(data: string): void;
        onError(err: Error): void;
      }`,
      errors: [
        { messageId: "preferPropertyFunction" },
        { messageId: "preferPropertyFunction" },
      ],
    },
    {
      code: `interface Generic<T> {
        map<U>(fn: (t: T) => U): Generic<U>;
      }`,
      errors: [{ messageId: "preferPropertyFunction" }],
    },
    {
      code: `interface Api {
        get(url: string): Promise<string>;
        post(url: string, body: unknown): Promise<void>;
      }`,
      errors: [
        { messageId: "preferPropertyFunction" },
        { messageId: "preferPropertyFunction" },
      ],
    },
    {
      code: `interface Handler {
        "handle"(req: Request): void;
      }`,
      errors: [
        { messageId: "preferPropertyFunction", data: { name: "handle" } },
      ],
    },
    {
      code: `interface Handler {
        handle?(req: Request): void;
      }`,
      errors: [
        { messageId: "preferPropertyFunction", data: { name: "handle" } },
      ],
    },
  ],
});
