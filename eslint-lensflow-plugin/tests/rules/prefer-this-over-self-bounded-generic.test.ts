import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-this-over-self-bounded-generic.js";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

ruleTester.run("prefer-this-over-self-bounded-generic", rule, {
  valid: [
    `class Builder {
      name(n: string): this {
        return this;
      }
    }`,
    `class Foo<T extends string> {
      value: T;
      constructor(v: T) { this.value = v; }
    }`,
    `class Foo<T> {
      value: T;
      constructor(v: T) { this.value = v; }
    }`,
    `class Foo<T extends Bar<T>, U> {
      value: T;
      other: U;
    }`,
    `class Foo<T extends { bar: T }> {
      value: T;
    }`,
    `const fn = (): (() => void) => {
      const C = class Foo<T> { value: T; constructor(v: T) { this.value = v; } };
      return C;
    };`,
  ],
  invalid: [
    {
      code: `class Builder<T extends Builder<T>> {
        name(n: string): T {
          return this as any as T;
        }
      }`,
      errors: [{ messageId: "selfBoundedGeneric", data: { className: "Builder", url: URL } }],
    },
    {
      code: `class Chain<T extends Chain<T>> {
        then(fn: () => void): T {
          return this as T;
        }
      }`,
      errors: [{ messageId: "selfBoundedGeneric", data: { className: "Chain", url: URL } }],
    },
    {
      code: `const C = class Chain<T extends Chain<T>> {
        then(fn: () => void): T { return this as T; }
      };`,
      errors: [{ messageId: "selfBoundedGeneric", data: { className: "Chain", url: URL } }],
    },
  ],
});
