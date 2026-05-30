import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const BUILT_IN_REFERENCES = new Set(["Error", "Object", "Record"]);

export default createRule({
  name: "no-concrete-type-bound",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic type parameters constrained by a concrete named type instead of a minimal structural shape",
    },
    messages: {
      concreteBound:
        "Generic parameter `{{param}}` is constrained by the concrete type `{{constraint}}` instead of a structural shape. Use an inline interface like `{{suggestion}}` to improve reusability. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedReferences: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ allowedReferences: [] as string[] }],
  create(context: TSESLint.RuleContext<"concreteBound", [{ allowedReferences: unknown }]>) {
    const [{ allowedReferences } = { allowedReferences: [] }] = context.options ?? [];
    const allowed = new Set([...BUILT_IN_REFERENCES, ...(allowedReferences as string[])]);

    return {
      TSTypeParameter(node) {
        if (!node.constraint) return;

        const constraint = node.constraint;

        if (constraint.type !== "TSTypeReference") return;

        const typeName =
          constraint.typeName.type === "Identifier"
            ? constraint.typeName.name
            : null;

        if (!typeName || allowed.has(typeName)) return;

        const paramName = node.name ? node.name.name : "T";

        context.report({
          node,
          messageId: "concreteBound",
          data: {
            param: paramName,
            constraint: typeName,
            suggestion: "{ /* minimal required shape */ }",
          },
        });
      },
    };
  },
});
