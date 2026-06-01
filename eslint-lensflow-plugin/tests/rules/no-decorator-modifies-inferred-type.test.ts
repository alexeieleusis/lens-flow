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

    // Nested class with declared property inside namespace — valid
    `function addId(target: unknown, ctx: ClassDecoratorContext) {
      Object.defineProperty(target, "id", { value: Math.random() });
    }

    namespace MyNS {
      @addId
      class Entity {
        id: number;
      }
    }`,

    // Arrow function decorator with property declared on class
    `const addId = (target: unknown, ctx: ClassDecoratorContext) => {
      Object.defineProperty(target, "id", { value: Math.random() });
    };

    @addId
    class Entity {
      id: number;
    }`,

    // Function expression decorator with property declared on class
    `const addId = function(target: unknown, ctx: ClassDecoratorContext) {
      Object.defineProperty(target, "id", { value: Math.random() });
    };

    @addId
    class Entity {
      id: number;
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

    // Nested inside namespace
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      namespace MyNS {
        @addId
        class Entity {}
      }`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },

    // Nested inside if block
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      if (true) {
        @addId
        class Entity {}
      }`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },

    // Nested inside IIFE
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      (function() {
        @addId
        class Entity {}
      })();`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },

    // Nested inside function
    {
      code: `function addId(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      function factory() {
        @addId
        class Entity {}
        return Entity;
      }`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },

    // Arrow function decorator adding undeclared property
    {
      code: `const addId = (target: unknown, ctx: ClassDecoratorContext) => {
        Object.defineProperty(target, "id", { value: Math.random() });
      };

      @addId
      class Entity {}`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },

    // Function expression decorator adding undeclared property
    {
      code: `const addId = function(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      };

      @addId
      class Entity {}`,
      errors: [{ messageId: "decoratorModifiesInferredType" }],
    },
  ],
});
