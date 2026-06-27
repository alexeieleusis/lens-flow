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

    // TSParameterProperty as decorator param
    `class DecoratorFactory {
      constructor(public ctx: ClassDecoratorContext) {}
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

    // Qualified type reference (TSQualifiedName) — property declared on class
    `import * as ts from "typescript";
    function addId(target: unknown, ctx: ts.ClassDecoratorContext) {
      Object.defineProperty(target, "id", { value: Math.random() });
    }

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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
    },
    {
      code: `function addMeta(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "version", { value: "1.0" });
        Object.defineProperty(target, "author", { value: "anon" });
      }

      @addMeta
      class Widget {}`,
      errors: [{
        messageId: "decoratorModifiesMultipleProperties",
        data: { properties: '"version", "author"' },
      }],
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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
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
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
    },

    // Arrow function decorator adding undeclared property
    {
      code: `const addId = (target: unknown, ctx: ClassDecoratorContext) => {
        Object.defineProperty(target, "id", { value: Math.random() });
      };

      @addId
      class Entity {}`,
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
    },

    // Function expression decorator adding undeclared property
    {
      code: `const addId = function(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      };

      @addId
      class Entity {}`,
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
    },

    // Object.defineProperties (plural) adding undeclared properties
    {
      code: `function addMeta(target: unknown, ctx: ClassDecoratorContext) {
        Object.defineProperties(target, {
          "version": { value: "1.0" },
          "author": { value: "anon" },
        });
      }

      @addMeta
      class Widget {}`,
      errors: [{
        messageId: "decoratorModifiesMultipleProperties",
        data: { properties: '"version", "author"' },
      }],
    },

    // Qualified type reference (TSQualifiedName) — property not declared on class
    {
      code: `import * as ts from "typescript";
      function addId(target: unknown, ctx: ts.ClassDecoratorContext) {
        Object.defineProperty(target, "id", { value: Math.random() });
      }

      @addId
      class Entity {}`,
      errors: [{
        messageId: "decoratorModifiesInferredType",
        data: { property: "id" },
      }],
    },
  ],
});
