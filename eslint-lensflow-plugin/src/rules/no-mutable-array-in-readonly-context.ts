import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isArrayType(type: ts.Type) {
  const props = type.getProperties();
  return props.some((p) => p.name === "length");
}

function isMutableArray(type: ts.Type) {
  const props = type.getProperties();
  return props.some(
    (p) => p.name === "push" || p.name === "pop" || p.name === "splice"
  );
}

function isReadonlyArray(type: ts.Type) {
  return isArrayType(type) && !isMutableArray(type);
}

export default createRule({
  name: "no-mutable-array-in-readonly-context",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assigning a readonly array to a mutable array without copying",
     },
    messages: {
      mutableAssignmentFromReadonly:
        "Assigning readonly array '{{source}}' to mutable array '{{target}}' without copying. Use spread (e.g., [...{{source}}]) to create a mutable copy. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableAssignmentFromReadonly", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (!node.init || node.id?.type !== "Identifier") return;
        if (node.init.type !== "Identifier") return;

        const targetType = parserServices.getTypeAtLocation(node.id);
        if (!isMutableArray(targetType)) return;

        const sourceType = parserServices.getTypeAtLocation(node.init);
        if (!isReadonlyArray(sourceType)) return;

        context.report({
          node,
          messageId: "mutableAssignmentFromReadonly",
          data: {
            source: node.init.name,
            target: node.id.name,
          },
        });
      },
    };
  },
});
