// eslint-plugin/tests/rules/no-throw-in-result-function.test.ts
import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-throw-in-result-function.js";

ruleTester.run("no-throw-in-result-function", rule, {
  valid: [
    `function process(input: string): Result<Data, E> {
      const parsed = parse(input);
      if (!parsed.ok) return err(parsed.error);
      return ok(parsed.value);
    }`,
    `const handler = (input: string): Result<Data, E> => {
      const parsed = parse(input);
      if (!parsed.ok) return err(parsed.error);
      return ok(parsed.value);
    };`,
    `function assertNever(x: never): never {
      throw new Error(\`Unexpected value: \${x}\`);
    }`,
    `function fail(message: string): never {
      throw new Error(message);
    }`,
    `function assertNonNull(x: unknown): asserts x is NonNullable<unknown> {
      if (x == null) throw new Error("null");
    }`,
    `function assertCondition(cond: boolean): Result<void, Error> {
      return ok(undefined);
    }`,
    `function normalFunction(input: string): string {
      if (!input) throw new Error("empty");
      return input;
    }`,
    `const arrow = (x: number): string => {
      if (x < 0) throw new Error("negative");
      return String(x);
    };`,
    `const fn = (x: number): Result<number, E> => ok(x);`,
    `function process(input: string): Result<Data, E> {
      const callback = (): string => { throw new Error("inner"); };
      return ok(callback());
    }`,
    `function fetch(url: string): TE.TaskEither<Error, Response> {
      return TE.right(new Response());
    }`,
    `const handler = (input: string): E.Either<Data, E> => {
      if (!input) return E.left(new Error("empty"));
      return E.right(input as Data);
    };`,
    `function parse(id: string): Result<User, Error> | null {
      return ok({ id } as User);
    }`,
  ],
  invalid: [
    {
      code: `function process(input: string): Result<Data, E> {
        const parsed = parse(input);
        if (!parsed.ok) throw new Error(parsed.error.message);
        return ok(parsed.value);
      }`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `const handler = (input: string): Either<Data, E> => {
        const parsed = parse(input);
        if (!parsed.ok) throw new Error("parse failed");
        return right(parsed.value);
      };`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `function fetchData(url: string): TaskEither<Error, Response> {
        if (!url) throw new Error("url required");
        return TaskEither.fromIO(() => fetch(url));
      }`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `function validate(data: unknown): Result<Data, ValidationError> {
        try {
          return ok(JSON.parse(data as string) as Data);
        } catch {
          throw new Error("invalid");
        }
      }`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `const fn = function (x: string): Result<string, Error> {
        if (x.length === 0) throw new Error("empty");
        return ok(x);
      };`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `function fetch(url: string): TE.TaskEither<Error, Response> {
        if (!url) throw new Error("url required");
        return TE.right(new Response());
      }`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `const handler = (input: string): E.Either<Data, Err> => {
        if (!input) throw new Error("empty input");
        return E.right(input as Data);
      };`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
    {
      code: `function tryParse(s: string): Result<number, E> | null {
        if (!s) throw new Error("empty");
        return ok(Number(s));
      }`,
      errors: [{ messageId: "throwInResultFunction" }],
    },
  ],
});
