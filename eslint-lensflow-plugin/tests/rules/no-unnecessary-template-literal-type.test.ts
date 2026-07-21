import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unnecessary-template-literal-type.js";

ruleTester.run("no-unnecessary-template-literal-type", rule, {
  valid: [
    `type Status = "draft" | "published" | "archived";`,
    `type Label = \`pre_\${"a" | "b" | "c"}\`;`,
    `type Code = \`\${"x" | "y"}_suffix\`;`,
    `type Tag = \`a\${T}b\${U}\`;`,
    `type Mixed = \`status-\${"ok" | "err"}\` | "other";`,
    `type Numeric = \`\${1 | 2 | 3}\`;`,
    `type MixedLiterals = \`\${"a" | 1}\`;`,
    `type Bool = \`\${true | false}\`;`,
    `type Ref = \`\${string}\`;`,
    `function f(): \`pre_\${"a" | "b"}\` { return "pre_a"; }`,
    `const f = (): \`\${"x" | "y"}_suffix\` => "x_suffix";`,
    `function g<T extends \`tag-\${"a" | "b"}\`>() {}`,
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
    {
      code: `function f(): \`\${"a" | "b"}\` { return "a"; }`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
    {
      code: `const f = (): \`\${"x" | "y"}\` => "x";`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
    {
      code: `function g<T extends \`\${"a" | "b"}\`>() {}`,
      errors: [{ messageId: "unnecessaryTemplateLiteral" }],
    },
  ],
});
