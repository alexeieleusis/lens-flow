import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getNameFromKey(key: TSESTree.Node): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string")
    return key.value;
  return null;
}

export default createRule({
  name: "require-assertnever-never-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce that assertNever / assertExhaustive functions have a parameter typed as `never`",
    },
    messages: {
      badParamType:
        "The `{{name}}` parameter must be typed as `never` to preserve exhaustiveness checking. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"badParamType", []>) {
    const assertNeverPattern = /^assertNever$/;
    const assertExhaustivePattern = /^assertExhaustive$/;

    function extractParamIdentifier(
      firstParam: TSESTree.Parameter,
    ): TSESTree.Identifier | null {
      if (firstParam.type === "AssignmentPattern") {
        return firstParam.left.type === "Identifier" ? firstParam.left : null;
      }
      if (firstParam.type === "RestElement") {
        const arg = firstParam.argument;
        const unwrapped = arg.type === "AssignmentPattern" ? arg.left : arg;
        return unwrapped.type === "Identifier" ? unwrapped : null;
      }
      if (firstParam.type === "Identifier") {
        return firstParam;
      }
      return null;
    }

    function checkParams(
      funcName: string,
      params: TSESTree.Parameter[],
    ) {
      if (
        !assertNeverPattern.test(funcName) &&
        !assertExhaustivePattern.test(funcName)
      )
        return;

      const firstParam = params[0];
      if (!firstParam) return;

      const rawParam = extractParamIdentifier(firstParam);
      if (!rawParam) return;

      const typeAnn = rawParam.typeAnnotation?.typeAnnotation;
      if (typeAnn && typeAnn.type !== "TSNeverKeyword") {
        context.report({
          node: rawParam.typeAnnotation ?? rawParam,
          messageId: "badParamType",
          data: {
            name: rawParam.name,
          },
        });
      }
    }

    function checkFunction(
      node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
    ) {
      let funcName: string | undefined;

      if (node.type === "FunctionDeclaration" && node.id) {
        funcName = node.id.name;
      } else {
        const parent = node.parent;
        if (
          parent?.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          funcName = parent.id.name;
        } else if (parent?.type === "MethodDefinition") {
          funcName = getNameFromKey(parent.key) ?? undefined;
        }
      }

      if (!funcName) return;
      checkParams(funcName, node.params);
    }

    function checkTSDeclareFunction(
      node: TSESTree.TSDeclareFunction,
    ) {
      if (!node.id) return;
      const name =
        node.id.type === "Identifier"
          ? node.id.name
          : getNameFromKey(node.id);
      if (!name) return;
      checkParams(name, node.params);
    }

    function checkTSFunctionType(
      node: TSESTree.TSFunctionType,
    ) {
      const parent = node.parent;
      let funcName: string | undefined;

      if (
        parent?.type === "TSTypeAnnotation" &&
        parent.parent?.type === "VariableDeclarator" &&
        parent.parent.id.type === "Identifier"
      ) {
        funcName = parent.parent.id.name;
      } else if (
        parent?.type === "TSTypeAnnotation" &&
        parent.parent?.type === "PropertyDefinition" &&
        parent.parent.key.type === "Identifier"
      ) {
        funcName = parent.parent.key.name;
      }

      if (!funcName) return;
      checkParams(funcName, node.params);
    }

    function checkTSMethodSignature(
      node: TSESTree.TSMethodSignature,
    ) {
      const name = getNameFromKey(node.key);
      if (!name) return;
      checkParams(name, node.params);
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkTSDeclareFunction,
      TSFunctionType: checkTSFunctionType,
      TSMethodSignature: checkTSMethodSignature,
    };
  },
});
