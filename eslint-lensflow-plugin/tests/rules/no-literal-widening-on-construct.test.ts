import path from "node:path";
import { fileURLToPath } from "node:url";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-literal-widening-on-construct.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

ruleTester.run("no-literal-widening-on-construct", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
const good: PaymentStatus = { kind: "pending", amount: 100 };`,
    },
    {
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
const good = { kind: "pending" as const, amount: 100 };`,
    },
    {
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
const good = { kind: "pending", amount: 100 } satisfies PaymentStatus;`,
    },
    {
      filename: TEST_FILENAME,
      code: `const fine = { isPending: true, isDone: true };`,
    },
    {
      name: "destructured declarator — non-Identifier id should not report",
      filename: TEST_FILENAME,
      code: `const { kind, amount } = { kind: "pending", amount: 100 };`,
    },
    {
      name: "nested object expression — should not false-positive on inner literal",
      filename: TEST_FILENAME,
      code: `const fine = { wrapper: { status: "active" } };`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
const bad = { kind: "pending", amount: 100 };`,
      errors: [{ messageId: "widen" }],
    },
    {
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
const bad = { kind: "complete", amount: 200 };`,
      errors: [{ messageId: "widen" }],
    },
    {
      name: "multiple discriminant properties — only one error reported (rule returns after first)",
      filename: TEST_FILENAME,
      code: `const bad = { kind: "pending", status: "active" };`,
      errors: [{ messageId: "widen" }],
    },
    {
      name: "let declaration — widening should be reported",
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
let bad = { kind: "pending", amount: 100 };`,
      errors: [{ messageId: "widen" }],
    },
    {
      name: "var declaration — widening should be reported",
      filename: TEST_FILENAME,
      code: `import { PaymentStatus } from "./tests/fixtures/types.js";
var bad = { kind: "pending", amount: 100 };`,
      errors: [{ messageId: "widen" }],
    },
    {
      name: "computed property key — does not crash, reports widening correctly",
      filename: TEST_FILENAME,
      code: `const bad = { ["kind"]: "pending", amount: 100 };`,
      errors: [{ messageId: "widen" }],
    },
  ],
});
