import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const TS_UNION = "TSUnionType";
const IDENTIFIER = "Identifier";
const TS_PARAM_PROP = "TSParameterProperty";

function getUnionFingerprint(
  sourceCode: TSESLint.SourceCode,
  node: TSESTree.TSUnionType,
): string {
  return node.types
    .map((t) => sourceCode.getText(t).replace(/\s+/g, " ").trim())
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

function hasTypeParameters(
  node: FunctionLikeNode,
): boolean {
  return !!(node).typeParameters?.params.length;
}

type FunctionLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature
  | TSESTree.TSEmptyBodyFunctionExpression;

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
        "Parameters {{params}} share the same union type {{union}} without a shared generic type parameter. Use a generic type variable to couple them.",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"sharedUnionWithoutGeneric", []>) {
    const sourceCode = context.sourceCode;

    function collectUnionGroups(params: TSESTree.Parameter[]) {
      const unionGroups = new Map<string, { name: string; param: TSESTree.Parameter }[]>();

      for (const param of params) {
        let effectiveParam = param.type === TS_PARAM_PROP ? (param as any).parameter : param;
        if (effectiveParam.type === "AssignmentPattern") {
          effectiveParam = (effectiveParam as TSESTree.AssignmentPattern).left;
        }
        const typeAnn = (effectiveParam as TSESTree.Identifier).typeAnnotation;
        if (!typeAnn) continue;

        const typeAnnotation = typeAnn.typeAnnotation;
        if (typeAnnotation.type !== TS_UNION) continue;

        const fingerprint = getUnionFingerprint(sourceCode, typeAnnotation);
        const paramName =
          effectiveParam.type === IDENTIFIER
            ? (effectiveParam as TSESTree.Identifier).name
            : sourceCode.getText(effectiveParam as TSESTree.Node);

        if (!unionGroups.has(fingerprint)) {
          unionGroups.set(fingerprint, []);
        }
        unionGroups.get(fingerprint)!.push({ name: paramName, param });
      }

      return unionGroups;
    }

    function checkFunction(node: FunctionLikeNode) {
      if (hasTypeParameters(node)) return;

      const unionGroups = collectUnionGroups(node.params);

      for (const [fingerprint, groupEntries] of unionGroups) {
        if (groupEntries.length >= 2) {
          const groupParams = groupEntries.map((e) => e.name);
          context.report({
            node: groupEntries[0].param,
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
      FunctionExpression(node: TSESTree.FunctionExpression) {
        if (node.parent?.type === "MethodDefinition") return;
        checkFunction(node);
      },
      ArrowFunctionExpression: checkFunction,
      TSFunctionType: checkFunction,
      TSMethodSignature: checkFunction,
      TSEmptyBodyFunctionExpression: checkFunction,
      MethodDefinition(node: TSESTree.MethodDefinition) {
        checkFunction(node.value);
      },
    };
  },
});
