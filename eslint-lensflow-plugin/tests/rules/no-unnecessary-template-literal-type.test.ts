import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unnecessary-template-literal-type.js";

ruleTester.run("no-unnecessary-template-literal-type", rule, {
  valid: [
    `type Status = "draft" | "published" | "archived";`,
    `type Label = \`pre_\${"a" | "b" | "c"}\`;`,
    `type Code = \`\${"x" | "y"}_suffix\`;`,
    `type Tag = \`a\${T}b\${U}\`;`,
   `type Mixed = \`status-\${"ok" | "err"}\` | "other";`,
  ],
  invalid: [
    {
      code: `type Status = \`\${"draft" | "published" | "archived"}\`;`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
    {
      code: `type Mode = \`\${"active" | "inactive"}\`;`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
    {
      code: `type Color = \`\${"red" | "green" | "blue" | "yellow" | "purple"}\`;`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
    {
      code: `type Single = \`\${"one"}\`;`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
  ],
});
