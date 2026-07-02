import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-template-literal-number-catchall.js";

ruleTester.run("no-template-literal-number-catchall", rule, {
  valid: [
    `type T = \`port-\${"80" | "443"}\`;`,
    `type Port = "80" | "443";\ntype Url = \`http://localhost:\${Port}\`;`,
    `type Greeting = \`Hello, \${Name}\`;`,
    `type Id = \`\${string}\`;`,
    `type Path = \`/\${string}\`;`,
    `type Tag = \`<\${"div" | "span"}>\`;`,
    `type Mixed = \`prefix-\${string}-suffix\`;`,
  ],
  invalid: [
    {
      code: `type Port = \`\${number}\`;`,
      errors: [{ messageId: "bareNumber" }],
    },
    {
      code: `type Port = \`\${number}\`;\ntype Url = \`http://localhost:\${Port}\`;`,
      errors: [{ messageId: "bareNumber" }],
    },
    {
      code: `type Mixed = \`a-\${"x" | "y"}-\${string}\`;`,
      errors: [{ messageId: "bareString" }],
    },
    {
      code: `type Port = \`\${number}\`;\ntype Host = \`example.com:\${Port}\`;`,
      errors: [{ messageId: "bareNumber" }],
    },
  ],
});
