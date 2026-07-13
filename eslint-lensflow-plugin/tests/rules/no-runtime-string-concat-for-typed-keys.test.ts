import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-runtime-string-concat-for-typed-keys.js";

ruleTester.run("no-runtime-string-concat-for-typed-keys", rule, {
  valid: [
    `type Event = "click" | "focus";
function getHandler(event: Event) {
  return handlers[\`on\${event}\`];
}`,
    `function getSomething(event: string) {
  return cache[\`on\${event}\`];
}`,
    `function getHandler(event: string) {
  return handlers["staticKey"];
}`,
    `function getHandler(event: string, other: string) {
  return handlers[\`on\${other}\${event}\`];
}`,
    `function getHandler(event: string) {
  return handlers[\`on\${event}\${extra}\`];
}`,
    `type Event = "click" | "focus";
function getHandler(event: string) {
  const callback = (event: Event) => {
    return handlers[\`on\${event}\`];
  };
  return callback(event as any);
}`,
    `function getHandler(event: string) {
  const callback = () => {
    return handlers[\`on\${event}\`];
  };
  return callback();
}`,
    `type Event = "click" | "focus";
function getHandler(event: Event) {
  return handlers[(\`on\${event}\` as const)];
}`,
    `type Event = "click" | "focus";
function getHandler(event: Event) {
  return handlers[(\`on\${event}\` as const)!];
}`,
    `type Event = "click" | "focus";
function getHandler(event: Event) {
  return handlers[(\`on\${event}\` satisfies TemplateStringsArray)];
}`,
    {
      code: `function getHandler(event: string) {
  return myCustomTable[\`on\${event}\`];
}`,
      options: [{ tableNames: ["handlers", "dispatchers"] }],
    },
    // Non-Identifier parameter forms — the rule only checks Identifier params,
    // so these are valid (no error reported). Documented here to protect scope.
    // MemberExpression object — the rule checks `node.object.type !== "Identifier"`
    // and returns early for `this.handlers[...]`, `obj.handlers[...]`, etc.
    `function getHandler(event: string) {
  return this.handlers[\`on\${event}\`];
}`,
    `class Handler {
  constructor(readonly event: string) {
    const h = handlers[\`on\${this.event}\`];
  }
}`,
    `function getHandler(event: string = "default") {
  return handlers[\`on\${event}\`];
}`,
    `function getHandler({ event }: { event: string }) {
  return handlers[\`on\${event}\`];
}`,
  ],
  invalid: [
    {
      code: `function getHandler(event: string) {
  return handlers[\`on\${event}\`];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `const dispatch = (action: string) => {
  return dispatchers[\`handle\${action}\`];
};`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function lookup(key: string) {
  return registry[\`get\${key}\`];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function resolve(name: string) {
  return mappings[\`map\${name}\`];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function getHandler(event: string) {
  return handlers[(\`on\${event}\` as const)];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function getHandler(event: string) {
  return handlers[(\`on\${event}\`!)];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function getHandler(event: string) {
  return handlers[(\`on\${event}\` satisfies string)];
}`,
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
    {
      code: `function lookup(event: string) {
  return myCustomTable[\`on\${event}\`];
}`,
      options: [{ tableNames: ["myCustomTable"] }],
      errors: [{ messageId: "runtimeStringConcatKey" }],
    },
  ],
});
