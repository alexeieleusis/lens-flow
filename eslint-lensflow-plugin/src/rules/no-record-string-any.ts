import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function isRecordAny(node: TSESTree.TSTypeReference): boolean {
  const typeName = node.typeName;
  let name: string | null = null;
  if (typeName.type === "Identifier") {
    name = typeName.name;
  } else if (typeName.type === "TSQualifiedName") {
    name = typeName.right.name;
  }
  if (name !== "Record") return false;

  const params = node.typeArguments?.params;
  return !!(params && params.length === 2 && params[1].type === "TSAnyKeyword");
}

function reportRecordAny(
  context: TSESLint.RuleContext<"recordAny", []>,
  node: TSESTree.Node,
): void {
  context.report({
    node,
    messageId: "recordAny",
  });
}

function recurseIntoType(
  context: TSESLint.RuleContext<"recordAny", []>,
  typeNode: TSESTree.TypeNode,
): void {
  if (typeNode.type === "TSUnionType" || typeNode.type === "TSIntersectionType") {
    for (const t of typeNode.types) recurseIntoType(context, t);
  } else if (typeNode.type === "TSTypeReference") {
    const tn = typeNode;
    if (isRecordAny(tn)) {
      reportRecordAny(context, tn);
    }
    if (tn.typeArguments) {
      for (const p of tn.typeArguments.params) {
        recurseIntoType(context, p);
      }
    }
  } else if (typeNode.type === "TSTypeOperator") {
    if (typeNode.typeAnnotation) {
      recurseIntoType(context, typeNode.typeAnnotation);
    }
  } else if ((typeNode as any).type === "TSParenthesizedType") {
    const inner = (typeNode as any).typeAnnotation;
    if (inner) recurseIntoType(context, inner);
  }
}

export default createRule({
  name: "no-record-string-any",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `Record<K, any>` which loses all value type safety",
    },
    messages: {
      recordAny:
        "`Record<K, any>` loses value type safety. Use `Record<K, unknown>` and narrow with type guards. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"recordAny", []>) {
    return {
      TSTypeReference(node) {
        if (isRecordAny(node)) {
          reportRecordAny(context, node);
        }
        if (node.typeArguments) {
          for (const param of node.typeArguments.params) {
            recurseIntoType(context, param);
          }
        }
      },
    };
  },
});
