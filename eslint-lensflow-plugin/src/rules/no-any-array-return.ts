import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T45-paramspec-variadic.md");

function unwrapReadonly(node: any): any {
  if (node?.type === "TSTypeOperator" && node.operator === "readonly") {
    return node.typeAnnotation;
  }
  return node;
}

function isAnyArray(node: any): node is any {
  node = unwrapReadonly(node);

  if (node?.type === "TSArrayType" && node.elementType?.type === "TSAnyKeyword") {
    return true;
  }
  if (
    node?.type === "TSTypeReference" &&
    node.typeName?.type === "Identifier" &&
    node.typeName.name === "Array" &&
    node.typeArguments?.params?.length === 1 &&
    node.typeArguments.params[0]?.type === "TSAnyKeyword"
  ) {
    return true;
  }
  return false;
}

export default createRule({
  name: "no-any-array-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow returning any[] from a function, which discards all information about the output element type.",
    },
    messages: {
      anyArrayReturn:
        "Function returns any[] which discards all information about the output element type. Use a generic type parameter for the return array element type instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyArrayReturn", []>) {
    function checkReturn(node: any) {
      const returnType = node.returnType?.typeAnnotation;
      if (returnType && isAnyArray(returnType)) {
        context.report({
          node: returnType,
          messageId: "anyArrayReturn",
          data: {
            url: URL,
          },
        });
      }
    }

    return {
      FunctionDeclaration: checkReturn,
      TSMethodSignature: checkReturn,
      TSCallSignatureDeclaration: checkReturn,
      TSFunctionType: checkReturn,
      TSDeclareFunction: checkReturn,
      FunctionExpression: checkReturn,
      ArrowFunctionExpression: checkReturn,
    };
  },
});
