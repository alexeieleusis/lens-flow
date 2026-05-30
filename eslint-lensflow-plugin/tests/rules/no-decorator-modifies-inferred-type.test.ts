import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-decorator-modifies-inferred-type.js";

ruleTester.run("no-decorator-modifies-inferred-type", rule, {
  valid: [
    // Property declared on class — decorator is fine
    `function addId(target: unknown, ctx: ClassDecoratorContext) {
      Object.defineProperty(target, "id", { value: Math.random() });
    }

    @addId
    class Entity {
      id: number;
    }`,

    // No Object.defineProperty in decorator
    `function log(target: unknown, ctx: ClassDecoratorContext) {
      console.log(String(ctx.name) + " constructed");
    }

    @log
    class Foo {}`,

    // Property declared as instance field
    `function stamp(target: unknown, ctx: ClassDecoratorContext) {
      Object.defineProperty(target, "createdAt", { value: Date.now() });
    }

    @stamp
    class Entity {
      createdAt = 0;
    }`,

    // Non-decorator function with Object.defineProperty
    `function extend(obj: Record<string, unknown>, key: string, value: unknown) {
      Object.defineProperty(obj, key, { value });
    }`,

    // Decorator function applied to class that declares all properties
    `function addMeta(target: unknown, ctx: ClassDecoratorContext) {
      Object.defineProperty(target, "version", { value: "1.0" });
      Object.defineProperty(target, "author", { value: "anon" });
    }

    @addMeta
    class Widget {
      version: string;
      author: string;
    }`,
  ],
  invalid: [
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      @addId
      class Entity {}

      const e = new Entity();
      e.id;`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },
    {
      code: `function addMeta(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "version", { value: "1.0" });
        Object.defineProperty(target, "author", { value: "anon" });
      }

      @addMeta
      class Widget {}`,
      errors: [{ messageId: "decoratorModifiesMultipleProperties" }],
    },
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      function log(target: unknown, ctx: ClassDecoratorContext) {
        console.log(String(ctx.name));
      }

      @log
      @addId
      class Entity {
        name: string;
      }`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },
  ],
});
