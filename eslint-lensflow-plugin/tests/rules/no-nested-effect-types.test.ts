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
  ],
});
