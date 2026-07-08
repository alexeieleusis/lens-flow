import rule from "../../src/rules/no-mutate-nullable-without-check.js";
import { ruleTester } from "../helpers/rule-tester.js";

const TEST_FILENAME = "tests/rules/test.ts";

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
    {
      filename: TEST_FILENAME,
      code: `function safeWithAssert(draft: { title: string | null }) {
  if (draft.title === null) return;
  draft.title = draft.title!.toUpperCase();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function withElseThrow(draft: { title: string | null }) {
  if (draft.title !== null) {
    draft.title = draft.title!.toUpperCase();
  } else {
    throw new Error("title is null");
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function nestedGuard(draft: { title: string | null }) {
  for (let i = 0; i < 1; i++) {
    if (draft.title === null) return;
  }
  draft.title = draft.title!.toUpperCase();
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
