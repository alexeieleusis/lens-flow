import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-magic-string-discriminant-uc03.js";

ruleTester.run("no-magic-string-discriminant-uc03", rule, {
  valid: [
    `function getStatus(status: string): string {
      if (status === "pending") return "pending";
      return "unknown";
    }`,
    `function handle(kind: "a" | "b"): void {
      if (kind === "a") return;
      if (kind === "b") return;
    }`,
    `const fn = (x: number) => {
      if (x === 1) return true;
      if (x === 2) return true;
      return false;
    };`,
    `function compare(a: string, b: string): boolean {
      return a === b;
    }`,
  ],
  invalid: [
    {
      code: `function statusIcon(status: string): string {
        if (status === "pending") return "pending";
        if (status === "shipped") return "shipped";
        return "unknown";
      }`,
      errors: [{ messageId: "magicStringDiscriminant" }],
    },
    {
      code: `function process(type: string): void {
        if (type == "create") return;
        if (type == "update") return;
        if (type == "delete") return;
      }`,
      errors: [{ messageId: "magicStringDiscriminant" }],
    },
    {
      code: `const handler = (mode: string) => {
        if (mode === "light") return 1;
        if ("dark" === mode) return 2;
        return 0;
      };`,
      errors: [{ messageId: "magicStringDiscriminant" }],
    },
    {
      code: `(() => {
        function classify(category: string) {
          switch (category) {
            case "a": return 1;
            case "b": return 2;
          }
          if (category === "a") return true;
          if (category === "b") return false;
        }
      })();`,
      errors: [{ messageId: "magicStringDiscriminant" }],
    },
  ],
});
