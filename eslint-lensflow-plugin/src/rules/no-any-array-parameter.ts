import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

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

function isAnyTypeReference(node: {
  type: string;
  typeName?: { type: string; name?: string };
  typeArguments?: { params?: Array<{ type: string }> };
}): boolean {
  if (node.type !== "TSTypeReference") return false;
  const name = node.typeName?.type === "Identifier" ? node.typeName.name : undefined;
  if (name !== "Array" && name !== "ReadonlyArray") return false;
  return node.typeArguments?.params?.some((p) => isAnyType(p)) ?? false;
}

function hasAnyType(typeAnnotation: { type: string; elementType?: { type: string }; elementTypes?: Array<{ type: string }>; typeAnnotation?: { type: string; elementType?: { type: string }; elementTypes?: Array<{ type: string }> }; typeName?: { type: string; name?: string }; typeArguments?: { params?: Array<{ type: string }> }; types?: Array<{ type: string }> } | undefined): boolean {
  if (!typeAnnotation) return false;
  if (
    isAnyType(typeAnnotation) ||
    isAnyArrayType(typeAnnotation) ||
    isTupleWithAny(typeAnnotation) ||
    isAnyTypeReference(typeAnnotation)
  )
    return true;
  if (
    typeAnnotation.type === "TSTypeOperator" &&
    typeAnnotation.typeAnnotation
  ) {
    return hasAnyType(typeAnnotation.typeAnnotation);
  }
  if (
    typeAnnotation.type === "TSTypeReference" &&
    typeAnnotation.typeArguments?.params
  ) {
    return typeAnnotation.typeArguments.params.some(
      (p) => p && hasAnyType(p as Parameters<typeof hasAnyType>[0])
    );
  }
  if (typeAnnotation.type === "TSUnionType") {
    return typeAnnotation.types?.some(
      (t) => t && hasAnyType(t as Parameters<typeof hasAnyType>[0])
    ) ?? false;
  }
  if (typeAnnotation.type === "TSIntersectionType") {
    return typeAnnotation.types?.some(
      (t) => t && hasAnyType(t as Parameters<typeof hasAnyType>[0])
    ) ?? false;
  }
  return false;
}

export default createRule({
  name: "no-any-array-parameter",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any`, `any[]`, `Array<any>`, `ReadonlyArray<any>`, `readonly any[]`, and tuple parameters containing `any` in non-generic functions, as well as `any` return types. Applies to function declarations, expressions, arrow functions, function types, and declare functions.",
    },
    messages: {
      anyParam:
        "Parameter `{{name}}` uses `any`, `any[]` (equivalent to `Array<any>`), `ReadonlyArray<any>` (equivalent to `readonly any[]`), or a tuple containing `any`. Use a generic with constraints instead. See: {{url}}",
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
          typeName?: { type: string; name?: string };
          typeArguments?: { params?: Array<{ type: string }> };
        } | undefined;

        if (hasAnyType(typeAnn)) {
          context.report({
            node: param as never,
            messageId: "anyParam",
            data: { name: typeName, url: URL },
          });
        }
      }

      if (node.returnType?.typeAnnotation && isAnyType(node.returnType.typeAnnotation as { type: string })) {
        context.report({
          node: node.returnType as never,
          messageId: "anyReturn",
          data: { url: URL },
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
