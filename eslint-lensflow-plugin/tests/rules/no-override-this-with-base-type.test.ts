import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-override-this-with-base-type.js";

ruleTester.run("no-override-this-with-base-type", rule, {
  valid: [
    `class Base {
      getSelf(): this { return this; }
    }
    class GoodOverride extends Base {
      getSelf(): this { return super.getSelf(); }
    }`,
    `class Base {
      getName(): string { return "base"; }
    }
    class Child extends Base {
      getName(): string { return "child"; }
    }`,
    `class Standalone {
      getSelf(): this { return this; }
    }`,
    `class Base {
      getSelf(): this { return this; }
    }
    class Child extends Base {
      other(): void {}
    }`,
  ],
  invalid: [
    {
      code: `class Base {
        getSelf(): this { return this; }
      }
      class BadOverride extends Base {
        getSelf(): Base { return this; }
      }`,
      errors: [{ messageId: "overrideThisWithBaseType" }],
    },
    {
      code: `class Base {
        clone(): this { return this; }
        build(): this { return this; }
      }
      class Child extends Base {
        clone(): Base { return this; }
        build(): this { return this; }
      }`,
      errors: [{ messageId: "overrideThisWithBaseType" }],
    },
    {
      code: `class Base {
        getSelf(): this { return this; }
      }
      const C = class Child extends Base {
        getSelf(): unknown { return this; }
      }`,
      errors: [{ messageId: "overrideThisWithBaseType" }],
    },
    {
      code: `class Base {
        getSelf(): this { return this; }
      }
      class QuotedOverride extends Base {
        "getSelf"(): Base { return this; }
      }`,
      errors: [{ messageId: "overrideThisWithBaseType" }],
    },
  ],
});
