import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-unsafe-task-either-error-map.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "file.ts";
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

const TE_TYPES = `
type NetworkError = { tag: "NetworkError"; status: number };
type User = { id: string; name: string };
type ApiError = { tag: "ApiError"; code: string };
type IOError = { tag: "IOError"; message: string };

declare namespace TE {
  type TaskEither<E, A> = () => Promise<Either<E, A>>;
  function tryCatch<A, E>(
    tryfn: () => Promise<A>,
    catchfn: (e: unknown) => E,
  ): TaskEither<E, A>;
}

type Either<E, A> = { tag: "left"; left: E } | { tag: "right"; right: A };
`;

ruleTester.run("no-unsafe-task-either-error-map", rule, {
  valid: [
    // Correct: throws a typed error matching the declared error channel
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function fetchUser(id: string): TE.TaskEither<NetworkError, User> {
  return TE.tryCatch(
    async () => {
      const res = await fetch(\`/api/users/\${id}\`);
      if (!res.ok) throw { tag: "NetworkError" as const, status: res.status };
      return res.json();
    },
    () => ({ tag: "NetworkError", status: 0 }) as const,
  );
}`,
    },
    // Correct: constructs typed error in mapper
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function loadData(): TE.TaskEither<ApiError, string> {
  return TE.tryCatch(
    async () => {
      throw { tag: "ApiError" as const, code: "NOT_FOUND" };
    },
    () => ({ tag: "ApiError", code: "UNKNOWN" }),
  );
}`,
    },
    // Not a TE.tryCatch call — should not trigger
    {
      filename: TEST_FILENAME,
      code: `function normalFetch(): Promise<string> {
  return new Promise((resolve) => {
    try {
      throw new Error("fail");
    } catch (e) {
      resolve("ok");
    }
  });
}`,
    },
    // No return type annotation — can't determine error type
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function fetchData() {
  return TE.tryCatch(
    async () => { throw new Error("x"); },
    (e) => e as unknown,
  );
}`,
    },
  ],
  invalid: [
    // Throws generic Error, mapper uses unsafe `as` cast — two errors
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function fetchUser(id: string): TE.TaskEither<NetworkError, User> {
  return TE.tryCatch(
    async () => {
      const res = await fetch(\`/api/users/\${id}\`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    (e) => e as NetworkError,
  );
}`,
      errors: [
        { messageId: "unsafeThrow" },
        { messageId: "unsafeCast" },
      ],
    },
    // Only unsafe throw, no as cast in mapper
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function loadData(): TE.TaskEither<ApiError, string> {
  return TE.tryCatch(
    async () => {
      throw new Error("load failed");
    },
    () => ({ tag: "ApiError", code: "LOAD" }),
  );
}`,
      errors: [{ messageId: "unsafeThrow" }],
    },
    // Only unsafe as cast in mapper, throw is correct type
    {
      filename: TEST_FILENAME,
      code: TE_TYPES +
        `function readFile(): TE.TaskEither<IOError, Buffer> {
  return TE.tryCatch(
    async () => {
      throw { tag: "IOError" as const, message: "ENOENT" };
    },
    (e) => e as IOError,
  );
}`,
      errors: [{ messageId: "unsafeCast" }],
    },
  ],
});
