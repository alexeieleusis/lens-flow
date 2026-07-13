import path from "node:path";
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/no-exhaustiveness-on-open-union.js";

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

ruleTester.run("no-exhaustiveness-on-open-union", rule, {
  valid: [
    // Open union with proper fallback in default — no exhaustiveness check
    {
      filename: TEST_FILENAME,
      code: `function colorToHex(c: "red" | "blue" | string): string {
  switch (c) {
    case "red": return "#f00";
    case "blue": return "#00f";
    default: return "#000";
  }
}`,
    },
    // Closed union (no broad type) with exhaustiveness check — this is fine
    {
      filename: TEST_FILENAME,
      code: `function handle(s: "a" | "b") {
  switch (s) {
    case "a": break;
    default: throw new Error(\`Unreachable: \${s as never}\`);
  }
}`,
    },
    // Open union but default has no exhaustiveness check
    {
      filename: TEST_FILENAME,
      code: `function process(tag: "ok" | "err" | string): void {
  switch (tag) {
    case "ok": console.log("ok"); break;
    case "err": console.error("err"); break;
    default: console.warn("unknown:", tag);
  }
}`,
    },
    // Pure broad type — no literals, not an open union pattern
    {
      filename: TEST_FILENAME,
      code: `function handle(s: string) {
  switch (s) {
    case "x": break;
    default: throw new Error("bad");
  }
}`,
    },
    // Open union with number broad type — no exhaustiveness check
    {
      filename: TEST_FILENAME,
      code: `function handle(n: 1 | 2 | number) {
  switch (n) {
    case 1: break;
    case 2: break;
    default: return n;
  }
}`,
    },
    // Open union — variable declaration with proper fallback
    {
      filename: TEST_FILENAME,
      code: `function handle() {
  const c: "red" | "blue" | string = getValue();
  switch (c) {
    case "red": return "#f00";
    default: return "#000";
  }
}`,
    },
  ],
  invalid: [
    // Open string union with throw in default — the antipattern
    {
      filename: TEST_FILENAME,
      code: `function colorToHex(c: "red" | "blue" | string): string {
  switch (c) {
    case "red": return "#f00";
    case "blue": return "#00f";
    default: throw new Error(\`Unreachable: \${c as never}\`);
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
    // Open string union with as never cast in return
    {
      filename: TEST_FILENAME,
      code: `function handle(status: "idle" | "loading" | string) {
  switch (status) {
    case "idle": break;
    case "loading": break;
    default: return (status as never);
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
    // Open number union with exhaustiveness throw
    {
      filename: TEST_FILENAME,
      code: `function process(code: 200 | 404 | number): void {
  switch (code) {
    case 200: break;
    case 404: break;
    default: throw new Error(\`Bad code: \${code as never}\`);
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
    // Open boolean union with as never
    {
      filename: TEST_FILENAME,
      code: `function check(flag: true | false | boolean) {
  switch (flag) {
    case true: break;
    case false: break;
    default: throw new Error(\`Impossible: \${flag as never}\`);
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
    // Open union — variable declaration with exhaustiveness check
    {
      filename: TEST_FILENAME,
      code: `function handle() {
  const c: "red" | "blue" | string = getValue();
  switch (c) {
    case "red": return "#f00";
    default: throw new Error(\`Unreachable: \${c as never}\`);
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
    // Open union — throw nested inside BlockStatement in default branch
    {
      filename: TEST_FILENAME,
      code: `function handle(c: "red" | "blue" | string): string {
  switch (c) {
    case "red": return "#f00";
    default: { throw new Error(\`Unreachable: \${c as never}\`); }
  }
}`,
      errors: [{ messageId: "openUnion" }],
    },
  ],
});
