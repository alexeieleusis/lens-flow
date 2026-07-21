import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-this-return-fluent-method.js";

ruleTester.run("prefer-this-return-fluent-method", rule, {
  valid: [
    `class Base {
      setA(a: string): this { this.a = a; return this; }
    }`,
    `class Base {
      setA(a: string): void { this.a = a; }
    }`,
    `class Base {
      setA(a: string): Base { this.a = a; return new Base(); }
    }`,
    `class Base {
      setA(a: string): Other { return other; }
    }`,
    `class Base {
      create(): Base { return new Base(); }
    }`,
    `class Base {
      setA(): this { return this; }
    }
    class Derived extends Base {
      setD(): this { return this; }
    }`,
  ],
  invalid: [
    {
      code: `class Base {
        setA(a: string): Base { this.a = a; return this; }
      }
      class Derived extends Base {
        setD(d: string): Derived { this.d = d; return this; }
      }`,
      errors: [{ messageId: "preferThis" }, { messageId: "preferThis" }],
    },
    {
      code: `class Builder {
        setX(x: number): Builder { this.x = x; return this; }
        setY(y: number): Builder { this.y = y; return this; }
        build(): Builder { return this; }
      }`,
      errors: [
        { messageId: "preferThis" },
        { messageId: "preferThis" },
        { messageId: "preferThis" },
      ],
    },
    {
      code: `class A {
        chain(): A { return this; }
      }`,
      errors: [{ messageId: "preferThis" }],
    },
  ],
});
