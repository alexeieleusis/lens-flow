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
    // Function return type
    `function getUrl(): \`http://\${"localhost" | "example.com"}\` { return "http://localhost"; }`,
    // Interface property type
    `interface Config { port: \`port-\${"80" | "443"}\`; }`,
    // Type argument
    `type Wrapper<T> = { value: T };\ntype W = Wrapper<\`id-\${"a" | "b"}\`>;`,
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
    // Function return type
    {
      code: `function getPort(): \`\${number}\` { return "80"; }`,
      errors: [{ messageId: "bareNumber" }],
    },
    // Interface property type
    {
      code: `interface Config { port: \`\${number}\`; }`,
      errors: [{ messageId: "bareNumber" }],
    },
    // Type argument
    {
      code: `type Wrapper<T> = { value: T };\ntype W = Wrapper<\`\${number}\`>;`,
      errors: [{ messageId: "bareNumber" }],
    },
    // Nested template literal in interface property
    {
      code: `interface Config { host: \`a-\${"x" | "y"}-\${string}\`; }`,
      errors: [{ messageId: "bareString" }],
    },
    // ${number} takes priority over ${string} — both in same template literal
    {
      code: `type T = \`\${number}-\${string}\`;`,
      errors: [{ messageId: "bareNumber" }],
    },
    {
      code: `type T = \`\${string}-\${number}\`;`,
      errors: [{ messageId: "bareNumber" }],
    },
  ],
});
