import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-intrinsic-transform-on-wide-string.js";

ruleTester.run("no-intrinsic-transform-on-wide-string", rule, {
  valid: [
    `type Transform<T extends string> = Uppercase<T>;`,
    `type Result = Uppercase<"hello">;`,
    `type Result = Lowercase<"HELLO">;`,
    `type Result = Capitalize<"hello">;`,
    `type Result = Uncapitalize<"Hello">;`,
    `type Transform<T> = NonNullable<T>;`,
    `type Result = Uppercase<"a" | "b">;`,
    `interface Foo { bar: string; }`,
  ],
  invalid: [
    {
      code: `type Result = Uppercase<string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Lowercase<string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Capitalize<string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Uncapitalize<string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Upper = Uppercase<string>;
type Lower = Lowercase<string>;`,
      errors: [{ messageId: "noEffect" }, { messageId: "noEffect" }],
    },
    {
      code: `type Wrapper<T> = { upper: Uppercase<string>; };`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Uppercase<string & string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Lowercase<string & string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Capitalize<string & string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Uncapitalize<string & string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Uppercase<string | string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Lowercase<string | string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Capitalize<string | string>;`,
      errors: [{ messageId: "noEffect" }],
    },
    {
      code: `type Result = Uncapitalize<string | string>;`,
      errors: [{ messageId: "noEffect" }],
    },
  ],
});
