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
    // AssignmentPattern (default parameter) — single function, no duplicate
    `function deleteUser(id: string | null | undefined = "default") {
      if (!id) { throw new Error("no id"); }
    }`,
    // RestElement — single function, no duplicate
    `function logArgs(...args: (string | null)[]) {
      for (const a of args) {
        if (!a) { continue; }
      }
    }`,
    // ObjectPattern (destructuring) — rule skips, no report
    `function handle({ id }: { id: string | null }) {
      if (!id) { return; }
    }`,
    // ArrayPattern (destructuring) — rule skips, no report
    `function handle([id]: [string | null]) {
      if (!id) { return; }
    }`,
    // Guard nested inside an inner if — single function, no duplicate to flag
    `function processNestedIf(id: string | null) {
      if (someCondition) {
        if (!id) { return; }
      }
    }`,
    // Guard nested inside a for loop — single function, no duplicate to flag
    `function processInLoop(id: string | null) {
      for (const item of items) {
        if (!id) { break; }
      }
    }`,
    // Guard nested inside a try block — single function, no duplicate to flag
    `function processInTry(id: string | null) {
      try {
        if (!id) { throw new Error("missing"); }
      } catch (e) {
        console.error(e);
      }
    }`,
    // Guard nested inside for + inner if — single function, no duplicate to flag
    `function processDeeplyNested(id: string | null) {
      for (const item of items) {
        if (item.active) {
          if (!id) { continue; }
        }
      }
    }`,
    // Nested arrow function shadows parameter — guard belongs to inner scope
    `function outer(id: string | null) {
      inner((id: string | null) => {
        if (!id) { return; }
      });
    }`,
    // Single function with symbol | null — no duplicate to flag
    `function handleSymbol(sym: symbol | null) {
      if (!sym) { return; }
    }`,
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
    {
      code: `const handleA = function(input: string | null | undefined) {
        if (!input) { return ""; }
      };
      const handleB = function(input: string | null | undefined) {
        if (!input) { return "default"; }
      };`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
    {
      code: `function processA(id: string | null) {
        if (someCondition) {
          if (!id) { return; }
        }
      }
      function processB(id: string | null) {
        for (const x of list) {
          if (!id) { break; }
        }
      }`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
    {
      code: `function handleSym(sym: symbol | null) {
        if (!sym) { return; }
      }
      function checkSym(sym: symbol | null) {
        if (!sym) { return; }
      }`,
      errors: [
        { messageId: "redundantGuard" },
        { messageId: "redundantGuard" },
      ],
    },
  ],
});
