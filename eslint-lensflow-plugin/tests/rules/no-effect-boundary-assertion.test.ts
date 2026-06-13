import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-effect-boundary-assertion.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG,
      tsconfigRootDir: TS_CONFIG_DIR,
    },
  },
});

const EITHER_DEF = `
type Either<E, A> = {
  _tag: "Left" | "Right";
  left?: E;
  right?: A;
  map<B>(fn: (a: A) => B): Either<E, B>;
  match<B>(handlers: { Left: (e: E) => B; Right: (a: A) => B }): B;
};
`;

const TASK_EITHER_DEF = `
type TaskEither<E, A> = {
  _tag: "TaskEither";
  map<B>(fn: (a: A) => B): TaskEither<E, B>;
  match<B>(handlers: { Left: (e: E) => B; Right: (a: A) => B }): Promise<B>;
};
`;

const RESULT_DEF = `
type Result<A, E> = {
  _tag: "Ok" | "Err";
  val?: A;
  err?: E;
  map<B>(fn: (a: A) => B): Result<B, E>;
  unwrapOr(defaultVal: A): A;
};
`;

const USER_DEF = `
interface User {
  id: number;
  name: string;
}
`;

const ERROR_DEF = `
type AppError = { code: number; message: string };
`;

ruleTester.run("no-effect-boundary-assertion", rule, {
  valid: [
    // Correct pattern: discriminated union check instead of assertion
    {
      filename: TEST_FILENAME,
      code: EITHER_DEF + USER_DEF + ERROR_DEF + `
declare const either: Either<AppError, User>;
const user = either._tag === "Right" ? either.right : null;
      `,
    },
    // Correct pattern: using match on Either
    {
      filename: TEST_FILENAME,
      code: TASK_EITHER_DEF + USER_DEF + ERROR_DEF + `
declare const task: TaskEither<AppError, User>;
task.match({ Left: (e) => console.error(e), Right: (u) => console.log(u.name) });
      `,
    },
    // Assertion to non-inner type is not this antipattern
    {
      filename: TEST_FILENAME,
      code: EITHER_DEF + `
declare const e: Either<string, number>;
const x = e as unknown;
      `,
    },
    // Non-effect type assertion is fine
    {
      filename: TEST_FILENAME,
      code: `
interface User { id: number; name: string }
const obj: User = { id: 1, name: "test" };
const user = obj as User;
      `,
    },
    // Result type: using unwrapOr is correct
    {
      filename: TEST_FILENAME,
      code: RESULT_DEF + `
declare const r: Result<string, Error>;
const val = r.unwrapOr("default");
      `,
    },
  ],
  invalid: [
    // Asserting Either<E, User> to User
    {
      filename: TEST_FILENAME,
      code: EITHER_DEF + USER_DEF + ERROR_DEF + `
declare const either: Either<AppError, User>;
const user = either as User;
      `,
      errors: [{ messageId: "effectBoundaryBypass" }],
    },
    // Asserting TaskEither<Err, User> to User
    {
      filename: TEST_FILENAME,
      code: TASK_EITHER_DEF + USER_DEF + `
declare const fetchUser: (id: number) => TaskEither<Error, User>;
const task = fetchUser(1);
const user = task as User;
      `,
      errors: [{ messageId: "effectBoundaryBypass" }],
    },
    // Asserting Result<User, E> to User (first-param success convention)
    {
      filename: TEST_FILENAME,
      code: RESULT_DEF + `
declare const r: Result<string, Error>;
const val = r as string;
      `,
      errors: [{ messageId: "effectBoundaryBypass" }],
    },
    // Asserting Either with inline type
    {
      filename: TEST_FILENAME,
      code: EITHER_DEF + `
declare const e: Either<string, { id: number; name: string }>;
const data = e as { id: number; name: string };
      `,
      errors: [{ messageId: "effectBoundaryBypass" }],
    },
  ],
});
