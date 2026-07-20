import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-this-in-static-member.js";

ruleTester.run("no-this-in-static-member", rule, {
  valid: [
    `class Base {
      create(): this { return this; }
    }`,
    `class Base {
      static create(): Base { return new Base(); }
    }`,
    `class Base {
      static create<T extends typeof Base>(this: T): InstanceType<T> {
        return new this() as InstanceType<T>;
      }
    }`,
    `class Base {
      static getInstance(): Base {
        return new Base();
      }
    }`,
    `class Base {
      clone(): this { return Object.create(this); }
    }`,
    `class Base {
      create = (): this => new this();
    }`,
    `class Base {
      static create = (): Base => new Base();
    }`,
  ],
  invalid: [
    {
      code: `class Base {
        static create(): this { return new this(); }
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `class Factory {
        static build(): this | null {
          return Math.random() > 0.5 ? new this() : null;
        }
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `class Builder {
        static newInstance(): this {
          return new this();
        }
        static clone(source: this): this {
          return Object.create(source);
        }
      }`,
      errors: [{ messageId: "staticThisReturn" }, { messageId: "staticThisReturn" }],
    },
    {
      code: `class Base {
        static create(): this & { marker: true } {
          return {} as this & { marker: true };
        }
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `class Factory {
        static build(): (this | null) {
          return Math.random() > 0.5 ? new this() : null;
        }
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `abstract class Base {
        abstract static create(): this;
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `class Base {
        static create = (): this => new this();
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
    {
      code: `class Factory {
        static build = (): this | null => {
          return Math.random() > 0.5 ? new this() : null;
        };
      }`,
      errors: [{ messageId: "staticThisReturn" }],
    },
  ],
});
