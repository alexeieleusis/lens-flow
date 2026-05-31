import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-nested-result-return.js";

ruleTester.run("no-nested-result-return", rule, {
  valid: [
    `function loadAndProcess(): Result<Data, IoE | ParseE> {
  const io = fetchData();
  if (!io.ok) return err(io.error);
  const parsed = parse(io.value);
  if (!parsed.ok) return err(parsed.error);
  return ok(parsed.value);
}`,
    `const handler = (): Either<User, AuthE> => fetchUser();`,
    `type FlatResult = Result<string, Error>;`,
    `function simple(): Promise<Result<number, E>> {
      return ok(42);
    }`,
    `interface Config {
      isPending: boolean;
      isComplete: boolean;
    }`,
  ],
  invalid: [
    {
      code: `function loadAndProcess(): Result<Result<Data, ParseE>, IoE> {
  const io = fetchData();
  if (!io.ok) return err(io.error);
  return parse(io.value);
}`,
      errors: [{ messageId: "nestedResult" }],
    },
    {
      code: `const fn = (): Either<Either<A, E1>, E2> => ok(ok(1));`,
      errors: [{ messageId: "nestedResult" }],
    },
    {
      code: `function deep(): TaskEither<IO, Result<T, ParseE>> {
  return taskEither.tryCatch(() => parse());
}`,
      errors: [{ messageId: "nestedResult" }],
    },
  ],
});
