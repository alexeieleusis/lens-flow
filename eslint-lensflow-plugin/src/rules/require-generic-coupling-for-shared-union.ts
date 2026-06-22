import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const TS_UNION = "TSUnionType";
const IDENTIFIER = "Identifier";

function getUnionFingerprint(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.TSUnionType,
): string {
  return node.types.map((t) => sourceCode.getText(t).trim()).join("|");
}

function hasTypeParameters(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
    | TSESTree.TSFunctionType,
): boolean {
  return !!(node as TSESTree.FunctionDeclaration).typeParameters?.params.length;
}

type FunctionLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSFunctionType;

export default createRule({
  name: "require-generic-coupling-for-shared-union",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require generic coupling when multiple parameters share the same union type",
    },
    messages: {
      sharedUnionWithoutGeneric:
        "Parameters {{params}} share the same union type {{union}} without a shared generic type parameter. Use a generic type variable to couple them. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"sharedUnionWithoutGeneric", []>) {
    const sourceCode = context.sourceCode;

    function checkFunction(node: FunctionLikeNode) {
      if (hasTypeParameters(node)) return;

      const params = node.params;

      const unionGroups = new Map<string, string[]>();

      for (const param of params) {
        const effectiveParam = param.type === "TSParameterProperty" ? param.parameter : param;
        const typeAnn = effectiveParam.typeAnnotation;
        if (!typeAnn) continue;

        const typeAnnotation = typeAnn.typeAnnotation;
        if (typeAnnotation.type !== TS_UNION)
          continue;

        const fingerprint = getUnionFingerprint(sourceCode, typeAnnotation);
        const paramName =
          effectiveParam.type === IDENTIFIER
            ? effectiveParam.name
            : "_";

        if (!unionGroups.has(fingerprint)) {
          unionGroups.set(fingerprint, []);
        }
        unionGroups.get(fingerprint)!.push(paramName);
      }

      for (const [fingerprint, groupParams] of unionGroups) {
        if (groupParams.length >= 2) {
          context.report({
            node,
            messageId: "sharedUnionWithoutGeneric",
            data: {
              params: groupParams.join(", "),
              union: fingerprint.replace(/\|/g, " | "),
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSFunctionType: checkFunction,
    };
  },
});
