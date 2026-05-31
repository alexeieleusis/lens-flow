import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-shadowed-type-parameter.js";

ruleTester.run("no-shadowed-type-parameter", rule, {
  valid: [
    // Distinct type parameter names — no shadowing
    `function outer<T>(x: T) {
  function inner<U>(y: U) {
    return y;
  }
  return inner(x);
}`,
    // No nested generics at all
    `function process<T>(item: T): T {
  return item;
}`,
    // Arrow function with distinct names
    `function wrap<A>(a: A) {
  const fn = <B>(b: B) => a + String(b);
  return fn;
}`,
    // Same name but not nested (separate top-level functions)
    `function first<T>(x: T) { return x; }
function second<T>(x: T) { return x; }`,
    // Generic class with no nested shadow
    `class Box<T> {
  constructor(public value: T) {}
  map<U>(fn: (v: T) => U): Box<U> {
    return new Box(fn(this.value));
  }
}`,
    // Nested function without type parameters on inner
    `function outer<T>(x: T) {
  function inner(y: string) {
    return y;
  }
  return inner;
}`,
  ],
  invalid: [
    // Basic shadowing from the spec
    {
      code: `function outer<T>(x: T) {
  function inner<T>(y: T) {
    return y;
  }
  return inner(x);
}`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // Arrow function shadowing outer
    {
      code: `function makeHandler<T>(ctx: T) {
  return <T>(event: T) => event;
}`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // Deeply nested — both middle and inner shadow
    {
      code: `function outer<T>(x: T) {
  function middle<T>(y: T) {
    function inner<T>(z: T) {
      return z;
    }
    return inner(y);
  }
  return middle(x);
}`,
      errors: [
        { messageId: "shadowedTypeParam" },
        { messageId: "shadowedTypeParam" },
      ],
    },
    // Generic class shadowing
    {
      code: `class Outer<T> {
  inner<T>(x: T): T {
    return x;
  }
}`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // Multiple params where one shadows
    {
      code: `function outer<T, U>(a: T, b: U) {
  function inner<T, V>(c: T, d: V) {
    return c;
  }
  return inner(a, b);
}`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // Both params shadow
    {
      code: `function outer<T, U>(a: T, b: U) {
  function inner<T, U>(c: T, d: U) {
    return [c, d];
  }
  return inner(a, b);
}`,
      errors: [
        { messageId: "shadowedTypeParam" },
        { messageId: "shadowedTypeParam" },
      ],
    },
  ],
});
