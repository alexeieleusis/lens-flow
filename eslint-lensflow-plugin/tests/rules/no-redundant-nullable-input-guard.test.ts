import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-redundant-nullable-input-guard.js";

ruleTester.run("no-redundant-nullable-input-guard", rule, {
  valid: [
    // Single function with nullable param and guard — no duplicate to flag
    `function deleteUser(id: string | null | undefined) {
      if (!id || id.length === 0) { throw new Error("no id"); }
    }`,
    // Two functions but different parameter types
    `function foo(id: string | null) {
      if (!id) { return; }
    }
    function bar(count: number | null) {
      if (count === null) { return; }
    }`,
    // Two functions with nullable params but no guard pattern
    `function process(raw: string | null) {
      const val = raw || "";
    }
    function store(raw: string | null) {
      const val = raw ?? "default";
    }`,
    // Functions with non-nullable params
    `function deleteById(id: string) { return id; }
    function archiveById(id: string) { return id; }`,
  ],
  invalid: [
    {
      code: `function deleteUser(id: string | null | undefined) {
        if (!id || id.length === 0) { /* handle error */ }
      }
      function archiveUser(id: string | null | undefined) {
        if (!id || id.length === 0) { /* handle error */ }
      }`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
    {
      code: `function getName(raw: string | null) {
        if (!raw) { return ""; }
      }
      function getDisplayName(raw: string | null) {
        if (!raw) { return "unknown"; }
      }`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
    {
      code: `const parseA = (input: number | null | undefined) => {
        if (!input || input === 0) return null;
      };
      const parseB = (input: number | null | undefined) => {
        if (!input || input === 0) return -1;
      };`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
  ],
});
