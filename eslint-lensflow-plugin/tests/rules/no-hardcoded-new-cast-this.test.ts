import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-hardcoded-new-cast-this.js";

ruleTester.run("no-hardcoded-new-cast-this", rule, {
  valid: [
    `class GoodClone implements Cloneable {
      clone(): this {
        return Object.create(Object.getPrototypeOf(this)) as this;
      }
    }`,
    `class NoThisReturn {
      clone(): BadClone {
        return new BadClone();
      }
    }`,
    `class NoCastThis {
      clone(): this {
        return new BadClone();
      }
    }`,
    `class DynamicConstructor {
      clone(): this {
        return new this.constructor() as this;
      }
    }`,
    `class SafeClone implements Cloneable {
      clone(): this {
        const obj = Object.create(Object.getPrototypeOf(this));
        return obj as this;
      }
    }`,
    // Regression: nested arrow uses its own class, not the outer method
    `class Outer implements Cloneable {
      clone(): this {
        const inner = (): SomeOther => new SomeOther() as this;
        return Object.create(Object.getPrototypeOf(this)) as this;
      }
    }`,
  ],
  invalid: [
    {
      code: `class BadClone implements Cloneable {
        clone(): this {
          return new BadClone() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
    {
      code: `class Widget {
        copy(): this {
          return new Widget() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
    {
      code: `abstract class Base {
        abstract clone(): this;
      }
      class Derived extends Base {
        clone(): this {
          return new Derived() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
    {
      code: `class BadClone implements Cloneable {
        clone(): this | null {
          return new BadClone() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
    {
      code: `class BadClone implements Cloneable {
        clone(): this & Cloneable {
          return new BadClone() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
    {
      code: `class BadClone implements Cloneable {
        clone(): this | never {
          return new BadClone() as this;
        }
      }`,
      errors: [{ messageId: "hardcodedNewCastThis" }],
    },
  ],
});
