import ts from "typescript";
import {
  AST_NODE_TYPES,
  ESLintUtils,
  TSESLint,
} from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T49-associated-types.md");

function containsInfer(node: TSESTree.Node): boolean {
  return walkNodes(node, (n) => n.type === AST_NODE_TYPES.TSInferType, {
    stopAtFunctionBoundaries: false,
  });
}

function typeReferenceToString(node: TSESTree.TSTypeReference): string | null {
  if (node.typeArguments) return null;
  if (node.typeName.type === AST_NODE_TYPES.Identifier) {
    return node.typeName.name;
  }
  if (node.typeName.type === AST_NODE_TYPES.TSQualifiedName) {
    const parts: string[] = [];
    let current: TSESTree.EntityName = node.typeName;
    while (current.type === AST_NODE_TYPES.TSQualifiedName) {
      parts.unshift(current.right.name);
      current = current.left;
    }
    if (current.type === AST_NODE_TYPES.Identifier) {
      parts.unshift(current.name);
    }
    return parts.join(".");
  }
  return null;
}

export default createRule({
  name: "no-redundant-infer-conditional",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow conditional types that are redundant identity passthrough with never",
    },
    messages: {
      redundantConditional:
        "This conditional type is a redundant identity distribution. The check type is already constrained to extend the union type, so `T extends A | B ? T : never` is equivalent to just `T`. Use a simple type alias instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantConditional", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};
    const checker = parserServices.program.getTypeChecker();

    return {
      TSConditionalType(node) {
        const { checkType, extendsType, trueType, falseType } = node;

        // Condition 3: false branch is TSNeverKeyword
        if (falseType.type !== AST_NODE_TYPES.TSNeverKeyword) return;

        // No infer keyword in checkType or trueType — those are the identity
        // passthrough operands. infer in extendsType is irrelevant.
        if (containsInfer(checkType) || containsInfer(trueType)) return;

        // Condition 1: check type is a TSTypeReference
        if (checkType.type !== AST_NODE_TYPES.TSTypeReference) return;

        const checkName = typeReferenceToString(checkType);
        if (!checkName) return;

        // Condition 2: true branch is the same TSTypeReference (identity passthrough)
        if (trueType.type !== AST_NODE_TYPES.TSTypeReference) return;

        const trueName = typeReferenceToString(trueType);
        if (trueName !== checkName) return;

        // extendsType must be a TSUnionType
        if (extendsType.type !== AST_NODE_TYPES.TSUnionType) return;

        // Use the TypeScript checker to verify the check type is already a
        // subtype of extendsType. Without this check, `T extends A | B ? T :
        // never` would be flagged even when T is unconstrained, in which case
        // the conditional is a legitimate narrowing (e.g.,
        // `type Filter<T> = T extends string | number ? T : never`).
        const checkTypeNode =
          parserServices.esTreeNodeToTSNodeMap.get(checkType);
        const extendsTypeNode =
          parserServices.esTreeNodeToTSNodeMap.get(extendsType);
        if (!checkTypeNode || !extendsTypeNode) return;

        const checkTsType = checker.getTypeFromTypeNode(
          checkTypeNode as ts.TypeNode,
        );
        const extendsTsType = checker.getTypeFromTypeNode(
          extendsTypeNode as ts.TypeNode,
        );

        if (!checker.isTypeAssignableTo(checkTsType, extendsTsType)) return;

        context.report({
          node,
          messageId: "redundantConditional",
          data: { url: URL },
        });
      },
    };
  },
});
