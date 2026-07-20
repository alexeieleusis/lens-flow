import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mixed-null-undefined.js";

ruleTester.run("no-mixed-null-undefined", rule, {
  valid: [
    `type ExplicitAbsent = string | null;`,
    `type NotYetProvided = string | undefined;`,
    `type Safe = string | number | boolean;`,
    `function f(x: string | null) {}`,
    `function f(x: string | undefined) {}`,
    `function f(): string | null {}`,
    `function f(): string | undefined {}`,
    `type DuplicateNull = null | null;`,
    `type Parenthesized = (string | null);`,
    `type Wrapper = Array<string | null>;`,
  ],
  invalid: [
    {
      code: `type Confusing = string | null | undefined;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `type Bad = null | undefined;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `type Messy = number | null | undefined | string;`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `function f(x: string | null | undefined) {}`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `function f(): string | null | undefined {}`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `interface Foo { value: string | null | undefined }`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
    {
      code: `type Foo = { value: string | null | undefined }`,
      errors: [{ messageId: "mixedNullUndefined" }],
    },
  ],
});
