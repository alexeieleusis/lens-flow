import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-magic-string-switch.js";

ruleTester.run("no-magic-string-switch", rule, {
  valid: [
    // Typed parameter with discriminated union — not plain string
    `type Action = \`user:\${'create'|'delete'}\`;
function handle(kind: Action) {
  switch (kind) {
    case "user:create": break;
    case "user:delete": break;
  }
}`,
    // Plain string but case values are not namespaced
    `function handle(kind: string) {
  switch (kind) {
    case "foo": break;
    case "bar": break;
  }
}`,
    // Only one namespaced case value — need at least 2
    `function handle(kind: string) {
  switch (kind) {
    case "user:create": break;
    case "other": break;
  }
}`,
    // Switch discriminant does not match any parameter name
    `function handle(action: string) {
  switch (kind) {
    case "user:create": break;
    case "user:delete": break;
  }
}`,
    // Parameter is not plain string (e.g., a union type)
    `function handle(kind: "user:create" | "user:delete") {
  switch (kind) {
    case "user:create": break;
    case "user:delete": break;
  }
}`,
  ],
  invalid: [
    // Basic case from the antipattern snippet
    {
      code: `function handle(kind: string) {
  switch (kind) {
    case "user:create":
    case "user:delete":
  }
}`,
      errors: [{ messageId: "magicStringSwitch" }],
    },
    // Arrow function with namespaced cases
    {
      code: `const handle = (action: string) => {
  switch (action) {
    case "post:publish": break;
    case "post:draft": break;
  }
};`,
      errors: [{ messageId: "magicStringSwitch" }],
    },
    // Dot-separated namespaced values
    {
      code: `function route(path: string) {
  switch (path) {
    case "api.users.list": break;
    case "api.users.create": break;
  }
}`,
      errors: [{ messageId: "magicStringSwitch" }],
    },
    // More than two namespaced cases
    {
      code: `function handle(kind: string) {
  switch (kind) {
    case "user:create": break;
    case "user:delete": break;
    case "user:update": break;
  }
}`,
      errors: [{ messageId: "magicStringSwitch" }],
    },
    // FunctionExpression — object method definition
    {
      code: `const obj = {
  handle(kind: string) {
    switch (kind) {
      case "user:create": break;
      case "user:delete": break;
    }
  }
};`,
      errors: [{ messageId: "magicStringSwitch" }],
    },
  ],
});
