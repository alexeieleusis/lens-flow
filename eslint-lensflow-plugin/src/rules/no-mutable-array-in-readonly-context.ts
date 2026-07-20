import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T32-immutability-markers.md");

function createTypeCheckers(checker: ts.TypeChecker) {
  function isArrayType(type: ts.Type) {
    return checker.isArrayType(type);
  }

  function isMutableArray(type: ts.Type) {
    const pushProp = type.getProperty("push");
    if (!pushProp?.valueDeclaration) return false;
    const pushType = checker.getTypeOfSymbolAtLocation(pushProp, pushProp.valueDeclaration);
    return pushType.getCallSignatures().length > 0;
  }

  function isReadonlyArray(type: ts.Type) {
    if (isArrayType(type) && !isMutableArray(type)) return true;

    if (type.flags & ts.TypeFlags.Intersection) {
      const candidates = (type as ts.IntersectionType).types;
      for (const t of candidates) {
        if (isArrayType(t) && !isMutableArray(t)) return true;
      }
    }

    return false;
  }

  return { isArrayType, isMutableArray, isReadonlyArray };
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
        "Assigning readonly array '{{source}}' to mutable array '{{target}}' without copying. Use spread (e.g., [...{{source}}]) to create a mutable copy. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableAssignmentFromReadonly", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};

    const checker = parserServices.program.getTypeChecker();
    const { isMutableArray, isReadonlyArray } = createTypeCheckers(checker);

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
            url: URL,
          },
        });
      },
    };
  },
});
