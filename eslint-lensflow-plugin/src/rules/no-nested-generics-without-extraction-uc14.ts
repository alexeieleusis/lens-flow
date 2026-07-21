import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC14-extensibility.md");

function returnTypeReferencesInterface(
  returnType: import("@typescript-eslint/types").TSESTree.TypeNode | null,
  interfaceName: string,
): boolean {
  if (!returnType) return false;

  if (
    returnType.type === "TSUnionType" ||
    returnType.type === "TSIntersectionType"
  ) {
    return returnType.types.some((t) =>
      returnTypeReferencesInterface(t, interfaceName),
    );
  }

  if (returnType.type !== "TSTypeReference") return false;
  const tn = returnType.typeName;
  if (tn.type === "Identifier" && tn.name === interfaceName) return true;
  if (
    tn.type === "TSQualifiedName" &&
    tn.right.type === "Identifier" &&
    tn.right.name === interfaceName
  )
    return true;
  return false;
}

function getReturnType(
  node:
    | import("@typescript-eslint/types").TSESTree.TSMethodSignature
    | import("@typescript-eslint/types").TSESTree.TSFunctionType
    | import("@typescript-eslint/types").TSESTree.TSConstructorType,
): import("@typescript-eslint/types").TSESTree.TypeNode | null {
  if (node.type === "TSMethodSignature") {
    return node.returnType?.typeAnnotation ?? null;
  }
  if (node.type === "TSFunctionType") {
    return node.returnType?.typeAnnotation ?? null;
  }
  if (node.type === "TSConstructorType") {
    return node.returnType?.typeAnnotation ?? null;
  }
  return null;
}

export default createRule({
  name: "no-nested-generics-without-extraction-uc14",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallows generic interfaces where multiple methods return the enclosing interface type with substituted parameters, creating deep nesting and uncomposable types.",
    },
    messages: {
      selfReferencingMethods:
        "Interface '{{name}}' has {{count}} methods returning itself with substituted generics. Extract high-order operations into separate types to avoid deeply nested generics. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minSelfReferencingMethods: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minSelfReferencingMethods: 2 }],
  create(
    context: TSESLint.RuleContext<
      "selfReferencingMethods",
      [{ minSelfReferencingMethods?: number }]
    >,
  ) {
    const { minSelfReferencingMethods = 2 } = context.options[0] ?? {};

    return {
      TSInterfaceDeclaration(node) {
        if (!node.typeParameters || node.typeParameters.params.length === 0)
          return;

        const interfaceName = node.id.name;
        const body = node.body;
        let count = 0;

        for (const member of body.body) {
          if (
            (member.type === "TSMethodSignature" &&
              returnTypeReferencesInterface(
                getReturnType(member),
                interfaceName,
              )) ||
            (member.type === "TSPropertySignature" &&
              member.typeAnnotation?.typeAnnotation.type === "TSFunctionType" &&
              returnTypeReferencesInterface(
                getReturnType(member.typeAnnotation.typeAnnotation),
                interfaceName,
              )) ||
            (member.type === "TSPropertySignature" &&
              member.typeAnnotation?.typeAnnotation.type ===
                "TSConstructorType" &&
              returnTypeReferencesInterface(
                getReturnType(member.typeAnnotation.typeAnnotation),
                interfaceName,
              ))
          ) {
            count++;
          }
        }

        if (count >= minSelfReferencingMethods) {
          context.report({
            node,
            messageId: "selfReferencingMethods",
            data: {
              name: interfaceName,
              count: String(count),
              url: URL,
            },
          });
        }
      },
    };
  },
});
