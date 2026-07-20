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
   // Separate declare functions with same type param name — not nested
    `declare function outer<T>(x: T): void;
 declare function inner<T>(y: T): void;`,
    // Declare function with non-shadowing nested function
    `declare function outer<T>(x: T): void;
 declare function outer<U>(x: U): void;`,
    // TSDeclareFunction: declare function with distinct type param — no shadow
    `declare function create<U>(item: U): U;`,
    // TSDeclareFunction: standalone declare function — no nesting, no shadow
    `declare function init<T>(value: T): void;`,
    // TSDeclareFunction: inside module with distinct type param — no shadow
    `declare module M {
  declare function create<T>(item: T): T;
  declare function wrap<U>(item: U): U;
}`,
    // TSDeclareFunction: declare function inside generic declare class with distinct param
    `declare class Container<T> {
  create<U>(item: U): T;
}`,
    // Class expression with distinct names — no shadowing
    `const Factory = class Outer<T> {
  map<U>(fn: (v: T) => U): Outer<U> {
    return new Outer(fn);
  }
};`,
    // Abstract method with distinct type param — no shadow
    `abstract class Base<T> {
  abstract method<U>(x: U): U;
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
    // Anonymous class expression shadowing
    {
      code: `const Factory = class Outer<T> {
  method<T>(x: T): T { return x; }
};`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // Named class expression shadowing
    {
      code: `const Factory = class Box<T> {
  map<T>(fn: (v: T) => T): Box<T> { return new Box(fn); }
};`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // TSEmptyBodyFunctionExpression: abstract method shadows outer class type param
    {
      code: `abstract class Base<T> {
  abstract method<T>(x: T): T;
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
    // TSDeclareFunction: ambient method in generic class shadows outer type param
    {
      code: `declare class Container<T> {
  helper<T>(x: T): void;
}`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // TSDeclareFunction: multiple shadowed params in ambient class method
    {
      code: `declare class Box<T, U> {
  process<T, U>(a: T, b: U): void;
}`,
      errors: [
        { messageId: "shadowedTypeParam" },
        { messageId: "shadowedTypeParam" },
      ],
    },
    // TSDeclareFunction: declare function with arrow function shadowing inside
    {
      code: `declare function outer<T>(cb: <T>(x: T) => T): void;`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
    // TSDeclareFunction: declare function with nested arrow shadowing outer type param
    {
      code: `declare function pipe<T>(input: T, fn: <T>(v: T) => T): T;`,
      errors: [{ messageId: "shadowedTypeParam" }],
    },
  ],
});
