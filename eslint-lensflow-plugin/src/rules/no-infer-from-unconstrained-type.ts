import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T49-associated-types.md");

function extractTypeParams(
  node: TSESTree.Node,
): TSESTree.TSTypeParameter[] | null {
  if ("typeParameters" in node && node.typeParameters) {
    return node.typeParameters.params;
  }
  if (node.type === "TSMappedType") {
    return [
      {
        type: "TSTypeParameter",
        name: node.key,
        constraint: node.constraint,
        default: undefined,
        const: false,
        in: false,
        out: false,
      } as TSESTree.TSTypeParameter,
    ];
  }
  return null;
}

export default createRule({
  name: "no-infer-from-unconstrained-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `infer` on an unconstrained type parameter which produces `any` or an identity mapping.",
    },
    messages: {
      inferFromUnconstrained:
        "Using `infer` on unconstrained type parameter '{{paramName}}' (pattern `{{paramName}} extends infer {{inferName}} ? {{inferName}} : ...`) produces an identity mapping. Constrain the type parameter so inference targets a meaningful structure. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"inferFromUnconstrained", []>) {
    const paramScopeStack: TSESTree.TSTypeParameter[][] = [];

    function enterScope(node: TSESTree.Node) {
      const params = extractTypeParams(node);
      if (params && params.length > 0) {
        paramScopeStack.push(params);
      }
    }

    function exitScope(node: TSESTree.Node) {
      if (extractTypeParams(node)) {
        paramScopeStack.pop();
      }
    }

    return {
      TSConditionalType(node) {
        if (node.extendsType.type !== "TSInferType") return;

        const inferName = node.extendsType.typeParameter.name.name;

        if (
          node.checkType.type !== "TSTypeReference" ||
          node.checkType.typeName.type !== "Identifier"
        ) {
          return;
        }

        const refName = node.checkType.typeName.name;

        let isUnconstrained = false;
        for (let i = paramScopeStack.length - 1; i >= 0; i--) {
          const param = paramScopeStack[i].find((p) => p.name.name === refName);
          if (param) {
            isUnconstrained = !param.constraint;
            break;
          }
        }

        if (!isUnconstrained) return;

        if (
          node.trueType.type === "TSTypeReference" &&
          node.trueType.typeName.type === "Identifier" &&
          node.trueType.typeName.name === inferName
        ) {
          context.report({
            node,
            messageId: "inferFromUnconstrained",
            data: { paramName: refName, inferName, url: URL },
          });
        }
      },

      TSTypeAliasDeclaration(node) {
        enterScope(node);
      },
      "TSTypeAliasDeclaration:exit"(node) {
        exitScope(node);
      },
      TSInterfaceDeclaration(node) {
        enterScope(node);
      },
      "TSInterfaceDeclaration:exit"(node) {
        exitScope(node);
      },
      ClassDeclaration(node) {
        enterScope(node);
      },
      "ClassDeclaration:exit"(node) {
        exitScope(node);
      },
      TSFunctionType(node) {
        enterScope(node);
      },
      "TSFunctionType:exit"(node) {
        exitScope(node);
      },
      TSConstructorType(node) {
        enterScope(node);
      },
      "TSConstructorType:exit"(node) {
        exitScope(node);
      },
      TSMethodSignature(node) {
        enterScope(node);
      },
      "TSMethodSignature:exit"(node) {
        exitScope(node);
      },
      TSPropertySignature(node) {
        enterScope(node);
      },
      "TSPropertySignature:exit"(node) {
        exitScope(node);
      },
      TSMappedType(node) {
        enterScope(node);
      },
      "TSMappedType:exit"(node) {
        exitScope(node);
      },
      ArrowFunctionExpression(node) {
        enterScope(node);
      },
      "ArrowFunctionExpression:exit"(node) {
        exitScope(node);
      },
      FunctionDeclaration(node) {
        enterScope(node);
      },
      "FunctionDeclaration:exit"(node) {
        exitScope(node);
      },
      FunctionExpression(node) {
        enterScope(node);
      },
      "FunctionExpression:exit"(node) {
        exitScope(node);
      },
      TSDeclareFunction(node) {
        enterScope(node);
      },
      "TSDeclareFunction:exit"(node) {
        exitScope(node);
      },
    };
  },
});
