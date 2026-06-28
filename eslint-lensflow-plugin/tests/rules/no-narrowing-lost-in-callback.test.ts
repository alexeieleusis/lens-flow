import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-narrowing-lost-in-callback.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __dirname = path.resolve(fileURLToPath(import.meta.url), "..");
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

ruleTester.run("no-narrowing-lost-in-callback", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    const v = value;
    setTimeout(() => console.log(v.length), 0);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    console.log(value.length);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    const fn = () => console.log(value.length);
  }
}`,
    },
    {
      // Truthiness-based narrowing (e.g., `if (value)`) is intentionally out of
      // scope for this rule. The rule's isNarrowingTest only matches BinaryExpression
      // with != / !== operators, because those are the explicit nullish-check patterns
      // where developers commonly assume narrowing is guaranteed. Truthiness checks
      // depend on type-level analysis (is the type possibly falsy?) and would require
      // significantly more complex logic to detect reliably. This test confirms the
      // rule does not falsely report on non-nullable types.
      filename: TEST_FILENAME,
      code: `function render(value: string) {
  if (value != null) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
    },
    {
      // Truthiness-based narrowing: `if (value)` is an Identifier, not a
      // BinaryExpression, so isNarrowingTest returns null. This pattern is out
      // of scope for this rule — see comment above.
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    setTimeout((value) => console.log(value.length), 0);
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    someFn(() => {
      const inner = (value: string) => {
        setTimeout(() => console.log(value.length), 0);
      };
    });
  }
}`,
    },
    {
      // Scope shadowing regression: a nested function parameter with the same name
      // as the outer narrowed variable should NOT trigger the rule. The only
      // references to `value` in the callback body are inside the nested function
      // where it's shadowed by the parameter. findIdentifierInNode stops at function
      // boundaries, so the shadowed `value` should not be found.
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    setTimeout(() => {
      const handler = (value: string) => console.log(value.length);
      handler("test");
    }, 0);
  }
}`,
    },
    {
      // Nested function boundary test: a callback defined inside a nested function
      // within the if block. The findCallbacks walker skips function bodies, so the
      // inner setTimeout should NOT be discovered as a callback of the outer if block.
      // Only the outer callback (if any) at the direct if-block level should be found.
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    const nested = () => {
      setTimeout(() => console.log(value.length), 0);
    };
  }
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value !== null) {
    Promise.resolve().then(() => console.log(value.length));
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value !== undefined) {
    setInterval(() => console.log(value.length), 1000);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value != null) {
    somePromise.catch((err) => console.log(value.length));
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value === null) {
    setTimeout(() => console.log(value), 0);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | undefined) {
  if (value === undefined) {
    setTimeout(() => console.log(value), 0);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      // Covers `string | undefined` with `!== undefined` guard — the common
      // pattern from optional parameters or `?.` results. Without this test,
      // a regression in undefined handling by typeIncludesNullable would go
      // undetected, since all other invalid cases use `string | null`.
      filename: TEST_FILENAME,
      code: `function render(value: string | undefined) {
  if (value !== undefined) {
    setTimeout(() => console.log(value.length), 0);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (value == null) {
    Promise.resolve().then(() => console.log(value));
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
    {
      filename: TEST_FILENAME,
      code: `function render(value: string | null) {
  if (null === value) {
    setInterval(() => console.log(value), 1000);
  }
}`,
      errors: [{ messageId: "narrowingLost" }],
    },
  ],
});
