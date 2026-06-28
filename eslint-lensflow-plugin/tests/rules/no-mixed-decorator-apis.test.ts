import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-mixed-decorator-apis.js";

ruleTester.run("no-mixed-decorator-apis", rule, {
  valid: [
    // Only stage-3 decorators
    `function register(target: unknown, ctx: ClassDecoratorContext) {
      ctx.addInitializer(function (this: unknown) {
        console.log(String(ctx.name) + " constructed");
      });
    }

    @register
    class Foo {}`,

    // Only experimental decorators
    `function log(target: typeof MyClass) {}

    @log
    class MyClass {}`,

    // Mixed definitions but only one pattern used on the class
    `function stage3Deco(target: unknown, ctx: ClassDecoratorContext) {}
    function expDeco(target: typeof A) {}

    @stage3Deco
    class A {}`,

    // ClassExpression with only stage-3 decorators
    `function register(target: unknown, ctx: ClassDecoratorContext) {}

    const Foo = @register class {}`,

    // ClassExpression with only experimental decorators
    `function log(target: typeof MyClass) {}

    const MyClass = @log class {}`,
  ],
  invalid: [
    {
      code: `function stage3Decorator(target: any, ctx: ClassDecoratorContext) {}
function experimentalDecorator(target: typeof Foo) {}

@experimentalDecorator
@stage3Decorator
class Foo {}`,
      errors: [{ messageId: "mixedDecoratorApis" }],
    },
    {
      code: `function inject(target: unknown, ctx: ClassMethodDecoratorContext) {}
function freeze(target: typeof Service) {}

@freeze
@inject
class Service {}`,
      errors: [{ messageId: "mixedDecoratorApis" }],
    },

    // ClassExpression with mixed decorators
    {
      code: `function stage3Decorator(target: any, ctx: ClassDecoratorContext) {}
function experimentalDecorator(target: typeof Bar) {}

const Bar = @experimentalDecorator @stage3Decorator class {}`,
      errors: [{ messageId: "mixedDecoratorApis" }],
    },

    // Decorator factory syntax (CallExpression)
    {
      code: `function stage3Decorator(target: any, ctx: ClassDecoratorContext) {}
function experimentalDecorator(target: typeof Baz) {}

@stage3Decorator()
@experimentalDecorator()
class Baz {}`,
      errors: [{ messageId: "mixedDecoratorApis" }],
    },
  ],
});
