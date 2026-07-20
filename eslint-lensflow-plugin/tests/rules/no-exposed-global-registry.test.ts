import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-exposed-global-registry.js";

ruleTester.run("no-exposed-global-registry", rule, {
  valid: [
    `const registry = new Map<string, Plugin>();
function register(id: string, plugin: Plugin) {
  registry.set(id, plugin);
}`,
    `const cache = new Set<string>();
function addToCache(key: string) {
  cache.add(key);
}`,
    `class Manager {
  private registry = new Map<string, unknown>();
}`,
    `function makeRegistry() {
  const registry = new Map();
  return registry;
}`,
    `const registry = new Map();
const another = new Set();`,
    // Non-Identifier (ObjectPattern) — silently ignored by rule (intentional scope exclusion).
    // The init is an ObjectExpression, not a NewExpression, so the rule's check at line 46 doesn't match.
    `const { registry } = { registry: new Map() };`,
    // Exported destructuring from object literal — same reason, not flagged.
    `const { registry } = { registry: new Set() };
export { registry };`,
  ],
  invalid: [
    {
      code: `const plugins = new Map<string, Plugin>();
export { plugins };`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `export const cache = new Set<string>();`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `export const registry = new Map();`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `const registry = new Map<string, string>();
export { registry as store };`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `export default new Map<string, Plugin>();`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `export default new Set();`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `const registry = new Map();
export default registry;`,
      errors: [{ messageId: "exposedRegistry" }],
    },
    {
      code: `const cache = new Set<string>();
export default cache;`,
      errors: [{ messageId: "exposedRegistry" }],
    },
  ],
});
