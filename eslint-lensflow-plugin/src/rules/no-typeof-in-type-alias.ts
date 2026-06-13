import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isTSNode(value: unknown): value is TSESTree.Node {
  return (
    value != null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as TSESTree.Node).type === "string" &&
    (value as TSESTree.Node).type.startsWith("TS")
  );
}

function processChild(child: unknown): boolean {
  if (Array.isArray(child)) {
    for (const item of child) {
      if (isTSNode(item) && hasTypeQuery(item)) return true;
    }
  } else if (isTSNode(child)) {
    if (hasTypeQuery(child)) return true;
  }
  return false;
}

function hasTypeQuery(node: TSESTree.Node): boolean {
  if (node.type === "TSTypeQuery") return true;

  for (const key of Object.keys(node)) {
    if (key === "loc" || key === "range" || key === "parent") continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (!child || typeof child !== "object") continue;

    if (processChild(child)) return true;
  }

  return false;
}

export default createRule({
  name: "no-typeof-in-type-alias",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow `typeof` inside type aliases to avoid coupling the alias to a runtime value's inferred shape",
    },
    messages: {
      typeofInAlias:
        "Type alias `{{name}}` uses `typeof`, coupling its shape to a runtime declaration. Use an explicit interface or type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T23-type-aliases.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"typeofInAlias", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        if (hasTypeQuery(node.typeAnnotation)) {
          context.report({
            node,
            messageId: "typeofInAlias",
            data: {
              name: node.id.name,
            },
          });
        }
      },
    };
  },
});
