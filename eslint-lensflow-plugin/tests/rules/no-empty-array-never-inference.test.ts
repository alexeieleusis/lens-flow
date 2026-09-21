import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-empty-array-never-inference.js";

ruleTester.run("no-empty-array-never-inference", rule, {
  valid: [
    `const items: string[] = [];`,
    `const items: number[] = [];
items.push(1);`,
    `const items = [1];`,
    `const items: any[] = [];`,
    `const items: unknown[] = [];`,
    `const items: readonly string[] = [];`,
    `let data = [];`,
    `var items = [];`,
    // Destructuring default sourced from a typed value: the identifier has no
    // annotation of its own, but its type is inferable from what it's
    // destructured from.
    `function f(context: { options: [{ allowedReferences?: string[] }] }) {
  const { allowedReferences = [] } = context.options[0] ?? {};
  return allowedReferences;
}`,
    `function f(context: { options: [{ ignorePatterns?: string[] }] }) {
  const [{ ignorePatterns = [] } = {}] = context.options ?? [];
  return ignorePatterns;
}`,
    // Same shape for a destructured function parameter whose whole pattern
    // carries the type annotation.
    `function Harness({
  requestSchemaFields = [],
}: Readonly<{ requestSchemaFields?: Array<Record<string, unknown>> }>) {
  return requestSchemaFields;
}`,
    `function f(pairs: [string[]?]) {
  const [items = []] = pairs;
  return items;
}`,
    // Object-literal property already governed by an explicit type: the
    // property itself carries no annotation, but the position it's checked
    // against does.
    `type Config = { items: string[] };
const config: Config = { items: [] };`,
    `type Config = { items: string[] };
function setup(options: Config) {}
setup({ items: [] });`,
    `type Config = { items: string[] };
function make(): Config {
  return { items: [] };
}`,
    // Same shape as the real occurrence in no-or-or-for-default-values.ts:
    // the parameter is typed, and the generic Options it introduces flows
    // back to type-check the sibling `defaultOptions` array.
    `interface RuleWithMeta<Options extends readonly unknown[]> {
  defaultOptions: Options;
  create: (options: Options) => void;
}
declare function createRule<Options extends readonly unknown[]>(
  rule: RuleWithMeta<Options>,
): void;
createRule({
  defaultOptions: [{ ignorePatterns: [] }],
  create(context: [{ ignorePatterns: string[] }]) {},
});`,
    // A rest parameter collapses to a single entry in `signature.parameters`,
    // so call arguments landing past that entry's index must still resolve
    // back to the rest parameter's explicit type.
    `declare function combine(label: string, ...configs: { tags: string[] }[]): void;
combine("x", { tags: [] }, { tags: [] });`,
  ],
  invalid: [
    {
      code: `const items = [];
items.push("hello");`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    {
      code: `const list = [];`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    // Destructuring default from an untyped/inferred source is still a real
    // never[] footgun.
    {
      code: `const { x = [] } = {};
x.push(1);`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    {
      code: `function Harness({ items = [] }) {
  return items;
}`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    // `satisfies` doesn't change the type TypeScript retains for the
    // literal, so this is still unsafe.
    {
      code: `type Config = { items: string[] };
const config = { items: [] } satisfies Config;`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    // A plain, unannotated object literal is still unsafe regardless of
    // nesting.
    {
      code: `const config = { items: [] };`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
    // `implements` doesn't contextually type a class field's initializer
    // either — the field keeps its own (never[]) inferred type.
    {
      code: `interface HasItems { items: string[] }
class Foo implements HasItems {
  items = [];
}`,
      errors: [{ messageId: "emptyArrayNoType" }],
    },
  ],
});
