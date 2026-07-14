import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const ID_NAME_RE = /^(id|.*[Ii][Dd])$/;

function isBareStringType(typeAnn: TSESTree.TypeNode): boolean {
  return typeAnn.type === "TSStringKeyword";
}

function isIdParam(param: TSESTree.Parameter): { name: string } | null {
  let paramName = "";

  if (param.type === "Identifier") {
    paramName = param.name;
  } else if (param.type === "TSParameterProperty") {
    if (param.parameter.type === "Identifier") {
      paramName = param.parameter.name;
    } else {
      return null;
    }
  } else {
    return null;
  }

  if (!ID_NAME_RE.test(paramName)) return null;

  const inner = param.type === "TSParameterProperty" ? param.parameter : param;
  const typeAnn = inner.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return null;
  if (!isBareStringType(typeAnn)) return null;

  return { name: paramName };
}

export default createRule({
  name: "no-plain-string-ids",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow multiple functions in the same module from accepting bare `string` parameters for entity IDs.",
    },
    messages: {
      plainStringId:
        "Parameter \"{{paramName}}\" is a bare `string` ID. Found {{count}} functions in this module with bare-string ID parameters — use branded types to prevent ID confusion. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"plainStringId", []>) {
    const violations: Array<{ fnNode: TSESTree.Node; paramNode: TSESTree.Node; paramName: string }> = [];

    function checkFunction(node: { params: TSESTree.Parameter[] }) {
      for (const param of node.params) {
        const idInfo = isIdParam(param);
        if (idInfo) {
          violations.push({ fnNode: node as TSESTree.Node, paramNode: param as TSESTree.Node, paramName: idInfo.name });
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node);
      },
      FunctionExpression(node) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node);
      },
      MethodDefinition(node) {
        checkFunction(node.value as { params: TSESTree.Parameter[] });
      },
      TSDeclareFunction(node) {
        checkFunction(node);
      },
      TSFunctionType(node) {
        checkFunction(node);
      },
      TSMethodSignature(node) {
        checkFunction(node);
      },
      TSCallSignatureDeclaration(node) {
        checkFunction(node);
      },
      "Program:exit"() {
        const uniqueByFn = [...new Map(violations.map(v => [v.fnNode, v])).values()];
        if (uniqueByFn.length < 2) return;
        for (const { paramNode, paramName } of uniqueByFn) {
          context.report({
            node: paramNode,
            messageId: "plainStringId",
            data: {
              paramName,
              count: String(uniqueByFn.length),
            },
          });
        }
      },
    };
  },
});
