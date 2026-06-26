import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function buildQualifiedName(node: TSESTree.TSQualifiedName): string {
  let left: string;
  if (node.left.type === "Identifier") {
    left = node.left.name;
  } else if (node.left.type === "TSQualifiedName") {
    left = buildQualifiedName(node.left);
  } else {
    left = "this";
  }
  return `${left}.${node.right.name}`;
}

function extractTypeName(typeNode: TSESTree.TypeNode): string {
  if (typeNode.type === "TSTypeReference") {
    const tn = typeNode.typeName;
    if (tn.type === "Identifier") return tn.name;
    if (tn.type === "TSQualifiedName") return buildQualifiedName(tn);
  }
  return "?";
}

export default createRule({
  name: "prefer-satisfies-over-annotation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `satisfies T` over `: T` for const bindings initialized with object literals containing literal values",
    },
    messages: {
      preferSatisfies:
        "Use `satisfies {{type}}` instead of `: {{type}}` to preserve literal types. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T52-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferSatisfies", []>) {
    return {
      VariableDeclarator(node) {
        const parent = node.parent;
        if (
          parent?.type !== "VariableDeclaration" ||
          parent.kind !== "const"
        ) {
          return;
        }

        const init = node.init;
        if (!init) return;

        if (init.type === "TSSatisfiesExpression") return;

        if (init.type !== "ObjectExpression") return;

        const hasLiteralValues = init.properties.some(
          (prop) =>
            prop.type === "Property" &&
            !prop.method &&
            prop.value.type === "Literal",
        );
        if (!hasLiteralValues) return;

        if (!node.id.typeAnnotation) return;

        const typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        let typeName = "?";
        if (typeAnnotation.type === "TSTypeReference") {
          typeName = extractTypeName(typeAnnotation);
        } else if (typeAnnotation.type === "TSUnionType") {
          typeName = typeAnnotation.types
            .map((t) => {
              if (t.type === "TSLiteralType") {
                const lit = t.literal;
                if (lit.type === "Literal") return String(lit.value);
              }
              return extractTypeName(t);
            })
            .join(" | ");
        }

        context.report({
          node,
          messageId: "preferSatisfies",
          data: { type: typeName },
        });
      },
    };
  },
});
