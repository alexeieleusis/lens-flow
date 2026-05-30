import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC04-generic-constraints.md";

function isAnyType(node: { type: string }): boolean {
  return node.type === "TSAnyKeyword";
}

function isAnyArrayType(node: { type: string; elementType?: { type: string } }): boolean {
  return node.type === "TSArrayType" && node.elementType != null && isAnyType(node.elementType);
}

function isTupleWithAny(node: {
  type: string;
  elementTypes?: Array<{ type: string }>;
}): boolean {
  return (
    (node.type === "TSTupleType" &&
      node.elementTypes?.some((el) => isAnyType(el))) ??
    false
  );
}

function hasAnyType(typeAnnotation: { type: string; elementType?: { type: string }; elementTypes?: Array<{ type: string }>; typeAnnotation?: { type: string; elementType?: { type: string }; elementTypes?: Array<{ type: string }> } } | undefined): boolean {
  if (!typeAnnotation) return false;
  if (
    isAnyType(typeAnnotation) ||
    isAnyArrayType(typeAnnotation) ||
    isTupleWithAny(typeAnnotation)
  )
    return true;
  if (
    typeAnnotation.type === "TSTypeOperator" &&
    typeAnnotation.typeAnnotation
  ) {
    return hasAnyType(typeAnnotation.typeAnnotation);
  }
  return false;
}

export default createRule({
  name: "no-any-array-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any[]` parameters and `any` return types in non-generic functions.",
    },
    messages: {
      anyParam:
        "Parameter `{{name}}` uses `any`, `any[]`, or a tuple containing `any`. Use a generic with constraints instead. See: {{url}}",
      anyReturn:
        "Function returns `any`. Use a generic return type instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function checkFunction(node: {
      params: Array<{
        type?: string;
        name?: string;
        typeAnnotation?: { typeAnnotation?: unknown };
        left?: {
          name?: string;
          typeAnnotation?: { typeAnnotation?: unknown };
        };
      }>;
      returnType?: { typeAnnotation?: unknown };
      typeParameters?: unknown;
    }) {
      if (node.typeParameters) return;

      for (const param of node.params) {
        if (param.type === "TSParameterProperty") continue;

        const base =
          (param as { type: string }).type === "AssignmentPattern"
            ? (param as { left: { name?: string; typeAnnotation?: { typeAnnotation?: unknown } } }).left
            : param;
        const typeName = ((base as { name?: string })?.name) ?? "unnamed";
        const typeAnn = (base as { typeAnnotation?: { typeAnnotation?: unknown } })?.typeAnnotation?.typeAnnotation as {
          type: string;
          elementType?: { type: string };
          elementTypes?: Array<{ type: string }>;
        } | undefined;

        if (hasAnyType(typeAnn)) {
          context.report({
            node: param as never,
            messageId: "anyParam",
            data: { name: typeName, url: KNOWLEDGE_URL },
          });
        }
      }

      if (node.returnType?.typeAnnotation && isAnyType(node.returnType.typeAnnotation as { type: string })) {
        context.report({
          node: node.returnType as never,
          messageId: "anyReturn",
          data: { url: KNOWLEDGE_URL },
        });
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
      TSFunctionType(node) {
        checkFunction(node);
      },
      TSDeclareFunction(node) {
        checkFunction(node);
      },
    };
  },
});
