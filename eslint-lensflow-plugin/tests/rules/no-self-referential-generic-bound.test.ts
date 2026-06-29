import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-self-referential-generic-bound.js";

ruleTester.run("no-self-referential-generic-bound", rule, {
  valid: [
    `function link<N extends Node<V>, V>(a: N, b: N): void {
  a.next = b;
}`,
    `type Node<T> = {
  value: T;
  next: Node<T> | null;
};`,
    `class Foo<T extends string> {
  val: T;
}`,
    `function identity<T>(x: T): T {
  return x;
}`,
    `interface Container<T extends { id: number }> {
  item: T;
}`,
  ],
  invalid: [
    {
      code: `type Node<T> = {
  value: T;
  next: Node<T> | null;
};

function link<T extends Node<T>>(a: T, b: T): void {
  a.next = b;
}`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `function process<T extends Array<T>>(items: T): void {}`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `class Builder<T extends Builder<T>> {
  build(): T { return this as T; }
}`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends Node<T> | string> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends { id: number } & T> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends (Node<T>)> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends T extends string ? T : never> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends Map<string, T>> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
    {
      code: `type X<T extends NS.Container<T>> = T`,
      errors: [{ messageId: "selfReferentialBound" }],
    },
  ],
});
