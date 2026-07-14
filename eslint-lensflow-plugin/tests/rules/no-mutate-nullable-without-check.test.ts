import rule from "../../src/rules/no-mutate-nullable-without-check.js";
import { ruleTester } from "../helpers/rule-tester.js";

const TEST_FILENAME = "file.ts";

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
      code: `function withThrowGuard(draft: { title: string | null }) {
  if (draft.title === null) throw new Error("title is null");
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
      // Non-null assertion after truthiness guard — redundant but NOT a violation
      filename: TEST_FILENAME,
      code: `function withGuardAndAssert(draft: { title: string | null }) {
  if (!draft.title) return;
  draft.title = draft.title!.toUpperCase();
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
    {
      filename: TEST_FILENAME,
      code: `function withUndefGuard(draft: { value: number | undefined }) {
  if (draft.value === undefined) return;
  draft.value = draft.value + 1;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function withUndefThrow(draft: { value: number | undefined }) {
  if (draft.value === undefined) throw new Error("value is undefined");
  draft.value = draft.value + 1;
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function withUndefBlock(draft: { value: number | undefined }) {
  if (draft.value !== undefined) {
    draft.value = draft.value + 1;
  }
}`,
    },
    {
      // Rule only fires on `!` assertions — plain mutation without `!` is not flagged
      filename: TEST_FILENAME,
      code: `function plainMutate(draft: { title: string | null }) {
  draft.title = someOtherValue;
}`,
    },
    {
      // Guard nested inside an if block should be detected
      filename: TEST_FILENAME,
      code: `function nestedIfGuard(draft: { title: string | null }) {
  if (someCondition) {
    if (draft.title === null) return;
  }
  draft.title = draft.title!.toUpperCase();
}`,
    },
    {
      // Guard nested inside a for loop within an if block should be detected
      filename: TEST_FILENAME,
      code: `function nestedLoopInIfGuard(draft: { title: string | null }) {
  if (someCondition) {
    for (let i = 0; i < 1; i++) {
      if (draft.title === null) return;
    }
  }
  draft.title = draft.title!.toUpperCase();
}`,
    },
    {
      // Guard inside a while loop should be detected
      filename: TEST_FILENAME,
      code: `function whileLoopGuard(draft: { title: string | null }) {
  while (condition) {
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
    {
      filename: TEST_FILENAME,
      code: `function outer(draft: { title: string | null }) {
  if (draft.title === null) return;
  const fn = function() {
    draft.title = draft.title!.toUpperCase();
  };
}`,
      errors: [{ messageId: "mutateNullableWithoutCheck" }],
    },
  ],
});
