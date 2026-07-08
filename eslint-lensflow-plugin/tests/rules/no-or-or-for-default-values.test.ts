import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-or-or-for-default-values.js";

ruleTester.run("no-or-or-for-default-values", rule, {
  valid: [
    // Using ?? is correct — should not flag
    `function getLabel(props: { label?: string }) {
  const label = props.label ?? "Default";
  return label;
}`,
    // || with a function call on the right is intentional boolean coercion
    `const result = flags.admin || ensureAdmin();`,
    // || with a function call on the right (not a default value literal)
    `const value = data || fetchDefault();`,
    // || with a non-default-value right operand (template literal)
    `const s = maybeStr || \`fallback\`;`,
    // Left side is not a member expression or identifier
    `(a + b) || "default";`,
    // Ignored via ignorePatterns
    {
      code: `const x = adminFlag || "fallback";`,
      options: [{ ignorePatterns: ["^admin"] }],
    },
    // || with null RHS — ?? is a no-op (still falls through on null/undefined)
    `const x = a || null;`,
    // || with undefined RHS — ?? is a no-op
    `const y = b || undefined;`,
    // || with negative numeric literal RHS — UnaryExpression, not Literal
    `const x = a || -1;`,
  ],
  invalid: [
    // String default via ||
    {
      code: `function getLabel(props: { label?: string }) {
  const label = props.label || "Default";
  return label;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function getLabel(props: { label?: string }) {
  const label = props.label ?? "Default";
  return label;
}`,
    },
    // Number default via || — 0 would be lost
    {
      code: `function getCount(config: { count?: number }) {
  const count = config.count || 10;
  return count;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function getCount(config: { count?: number }) {
  const count = config.count ?? 10;
  return count;
}`,
    },
    // Boolean default via || — false would be lost
    {
      code: `function isEnabled(settings: { enabled?: boolean }) {
  const enabled = settings.enabled || true;
  return enabled;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function isEnabled(settings: { enabled?: boolean }) {
  const enabled = settings.enabled ?? true;
  return enabled;
}`,
    },
    // Array default via ||
    {
      code: `function getItems(data: { items?: string[] }) {
  const items = data.items || [];
  return items;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function getItems(data: { items?: string[] }) {
  const items = data.items ?? [];
  return items;
}`,
    },
    // Object default via ||
    {
      code: `function getOpts(cfg: { opts?: Record<string, unknown> }) {
  const opts = cfg.opts || {};
  return opts;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function getOpts(cfg: { opts?: Record<string, unknown> }) {
  const opts = cfg.opts ?? {};
  return opts;
}`,
    },
    // Identifier (parameter) with string default
    {
      code: `function greet(name?: string) {
  const n = name || "World";
  return \`Hello, \${n}\`;
}`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `function greet(name?: string) {
  const n = name ?? "World";
  return \`Hello, \${n}\`;
}`,
    },
    // Optional chaining with string default — ChainExpression support
    {
      code: `const label = props?.label || "Default";`,
      errors: [{ messageId: "preferNullishCoalescing" }],
      output: `const label = props?.label ?? "Default";`,
    },
  ],
});
