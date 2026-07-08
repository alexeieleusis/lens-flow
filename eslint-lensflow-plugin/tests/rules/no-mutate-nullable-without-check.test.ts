import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-mutate-nullable-without-check.js";

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

ruleTester.run("no-mutate-nullable-without-check", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function capitalizeTitle(draft: { title: string | null }) {
  if (draft.title === null) return;
  draft.title = draft.title.toUpperCase();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function safe(draft: { title: string | null }) {
  if (draft.title !== null) {
    draft.title = draft.title.toUpperCase();
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function noNullIssue(draft: { title: string }) {
  draft.title = draft.title.toUpperCase();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function withGuard(draft: { title: string | null }) {
  if (!draft.title) return;
  draft.title = draft.title.toUpperCase();
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function capitalizeTitle(draft: { title: string | null }) {
  draft.title = draft.title!.toUpperCase();
}`,
      errors: [{ messageId: "mutateNullableWithoutCheck" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function update(draft: { value: number | undefined }) {
  draft.value = (draft.value! + 1);
}`,
      errors: [{ messageId: "mutateNullableWithoutCheck" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function process(item: { name: string | null }) {
  item.name = item.name!.trim().toLowerCase();
}`,
      errors: [{ messageId: "mutateNullableWithoutCheck" }],
    },
  ],
});
