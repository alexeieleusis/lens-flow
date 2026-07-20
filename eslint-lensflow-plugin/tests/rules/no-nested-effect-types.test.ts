import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-effect-types.js";

ruleTester.run("no-nested-effect-types", rule, {
  valid: [
    `function getUser(id: string): Promise<User> {
  return fetch(\`/users/\${id}\`).then(r => r.json());
}`,
    `function loadData(): Result<User, Error> {
  return ok({ name: "test" });
}`,
    `async function fetchUser(id: string): Promise<User> {
  return await fetch(\`/users/\${id}\`).then(r => r.json());
}`,
    `function safeDivide(a: number, b: number): Either<string, number> {
  return b === 0 ? left("division by zero") : right(a / b);
}`,
    `type State =
  | { kind: "pending" }
  | { kind: "complete" };`,
    // ArrowFunctionExpression — valid
    `const fetchUser = async (id: string): Promise<User> => {
  return fetch(\`/users/\${id}\`).then(r => r.json());
}`,
    // FunctionExpression — valid
    `const handler = function(): Result<User, Error> {
  return ok({ name: "test" });
}`,
    // TSDeclareFunction — valid
    `declare function init(): Promise<void>;`,
    // TSMethodSignature — valid
    `interface Service {
  getUser(id: string): Promise<User>;
}`,
    // TSCallSignatureDeclaration — valid
    `interface Api {
  (id: string): Promise<User>;
}`,
    // MethodDefinition — valid
    `class Service {
  getUser(id: string): Promise<User> {
    return fetch(\`/users/\${id}\`).then(r => r.json());
  }
}`,
  ],
  invalid: [
    {
      code: `async function getUser(id: string): Promise<Result<Promise<User>, Error>> {
  try {
    return ok((async () => await fetch(\`/users/\${id}\`).then(r => r.json()))());
  } catch (e) {
    return err(String(e));
  }
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    {
      code: `function process(): TaskEither<Error, Promise<number>> {
  return TE.right(Promise.resolve(42));
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    {
      code: `function doubleWrap(): Promise<Promise<string>> {
  return Promise.resolve(Promise.resolve("hello"));
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    {
      code: `function deep(): Promise<Result<Promise<Either<string, Task<number>>>, Error>> {
  throw new Error();
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    {
      code: `function f(): TE.TaskEither<E, Promise<A>> {
  throw new Error();
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // ArrowFunctionExpression — invalid
    {
      code: `const fetchUser = async (id: string): Promise<Promise<User>> => {
  return Promise.resolve(fetch(\`/users/\${id}\`).then(r => r.json()));
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // FunctionExpression — invalid
    {
      code: `const handler = function(): Promise<Promise<number>> {
  return Promise.resolve(Promise.resolve(42));
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // TSDeclareFunction — invalid
    {
      code: `declare function loadData(): Promise<Result<Promise<User>, Error>>;`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // TSMethodSignature — invalid
    {
      code: `interface Service {
  getUser(id: string): Promise<Promise<User>>;
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // TSCallSignatureDeclaration — invalid
    {
      code: `interface Api {
  (id: string): Promise<Promise<User>>;
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
    // MethodDefinition — invalid (covered via FunctionExpression visitor)
    {
      code: `class Service {
  getUser(id: string): Promise<Promise<User>> {
    return Promise.resolve(fetch(\`/users/\${id}\`));
  }
}`,
      errors: [{ messageId: "nestedEffect" }],
    },
  ],
});
