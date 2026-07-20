import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-decorator-accessor-keyword.js";

ruleTester.run("require-decorator-accessor-keyword", rule, {
  valid: [
    // accessor keyword present with accessor-context decorator
    `function clamp(
      _: ClassAccessorDecoratorTarget<unknown, number>,
      ctx: ClassAccessorDecoratorContext,
    ): ClassAccessorDecoratorResult<unknown, number> {
      return {
        get() { return _.get.call(this); },
        set(v: number) { _.set.call(this, Math.min(100, Math.max(0, v))); },
      };
    }

    class Sensor {
      @clamp
      accessor value = 50;
    }`,

    // accessor keyword with decorator factory call
    `function clamp(min: number, max: number) {
      return function (
        _: ClassAccessorDecoratorTarget<unknown, number>,
        ctx: ClassAccessorDecoratorContext,
      ): ClassAccessorDecoratorResult<unknown, number> {
        return {
          get() { return _.get.call(this); },
          set(v: number) { _.set.call(this, Math.min(max, Math.max(min, v))); },
        };
      };
    }

    class Sensor {
      @clamp(0, 100)
      accessor value = 50;
    }`,

    // field-context decorator without accessor keyword
    `function logField(
      target: unknown,
      ctx: ClassFieldDecoratorContext,
    ) {
      return;
    }

    class MyClass {
      @logField
      value = 10;
    }`,

    // property with no matching decorator definition in scope
    `class Other {
      @someUnknownDecorator
      value = 42;
    }`,
  ],
  invalid: [
    // accessor-context decorator on field missing accessor keyword
    {
      code: `function clamp(min: number, max: number) {
  return function (
    _: ClassAccessorDecoratorTarget<unknown, number>,
    ctx: ClassAccessorDecoratorContext,
  ): ClassAccessorDecoratorResult<unknown, number> {
    return {
      get() { return _.get.call(this); },
      set(v: number) { _.set.call(this, Math.min(max, Math.max(min, v))); },
    };
  };
}

class Sensor {
  @clamp(0, 100)
  value = 50;
}`,
      errors: [{ messageId: "missingAccessorKeyword" }],
    },
    // accessor-context decorator without factory wrapper
    {
      code: `function clamp(
  _: ClassAccessorDecoratorTarget<unknown, number>,
  ctx: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<unknown, number> {
  return {
    get() { return _.get.call(this); },
    set(v: number) { _.set.call(this, Math.min(100, Math.max(0, v))); },
  };
}

class Sensor {
  @clamp
  value = 50;
}`,
      errors: [{ messageId: "missingAccessorKeyword" }],
    },
    // field-context decorator on accessor field
    {
      code: `function logField(
  target: unknown,
  ctx: ClassFieldDecoratorContext,
) {
  return;
}

class MyClass {
  @logField
  accessor value = 10;
}`,
      errors: [{ messageId: "extraAccessorKeyword" }],
    },
    // accessor-context decorator as VariableDeclarator on field missing accessor keyword
    {
      code: `const clamp = function (
  _: ClassAccessorDecoratorTarget<unknown, number>,
  ctx: ClassAccessorDecoratorContext,
): ClassAccessorDecoratorResult<unknown, number> {
  return {
    get() { return _.get.call(this); },
    set(v: number) { _.set.call(this, Math.min(100, Math.max(0, v))); },
  };
};

class Sensor {
  @clamp
  value = 50;
}`,
      errors: [{ messageId: "missingAccessorKeyword" }],
    },
    // accessor-context decorator as arrow function VariableDeclarator on field missing accessor keyword
    {
      code: `const clamp = (_: ClassAccessorDecoratorTarget<unknown, number>, ctx: ClassAccessorDecoratorContext): ClassAccessorDecoratorResult<unknown, number> => ({
  get() { return _.get.call(this); },
  set(v: number) { _.set.call(this, Math.min(100, Math.max(0, v))); },
});

class Sensor {
  @clamp
  value = 50;
}`,
      errors: [{ messageId: "missingAccessorKeyword" }],
    },
    // accessor-context decorator factory as VariableDeclarator on field missing accessor keyword
    {
      code: `const clamp = (min: number, max: number) => {
  return function (
    _: ClassAccessorDecoratorTarget<unknown, number>,
    ctx: ClassAccessorDecoratorContext,
  ): ClassAccessorDecoratorResult<unknown, number> {
    return {
      get() { return _.get.call(this); },
      set(v: number) { _.set.call(this, Math.min(max, Math.max(min, v))); },
    };
  };
};

class Sensor {
  @clamp(0, 100)
  value = 50;
}`,
      errors: [{ messageId: "missingAccessorKeyword" }],
    },
  ],
});
