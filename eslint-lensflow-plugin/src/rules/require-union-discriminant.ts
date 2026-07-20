import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T07-structural-typing.md");

function unwrapParens(node: TSESTree.TypeNode): TSESTree.TypeNode {
  while (node.type === ("TSParenthesizedType" as TSESTree.TypeNode["type"])) {
    node = (node as unknown as { typeAnnotation: TSESTree.TypeNode }).typeAnnotation;
  }
  return node;
}

function flattenUnionMembers(types: TSESTree.TypeNode[]): TSESTree.TypeNode[] {
  const flattened: TSESTree.TypeNode[] = [];
  for (const type of types) {
    const unwrapped = unwrapParens(type);
    if (unwrapped.type === "TSUnionType") {
      flattened.push(
        ...flattenUnionMembers(
          (unwrapped as unknown as { types: TSESTree.TypeNode[] }).types,
        ),
      );
    } else {
      flattened.push(unwrapped);
    }
  }
  return flattened;
}

export default createRule({
  name: "require-union-discriminant",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require union members that are object types to have at least one literal-typed discriminant property.",
    },
    messages: {
      missingDiscriminant:
        "Union of object types has no member with a literal-typed discriminant property. Add a discriminant (e.g. `kind: \"circle\"`) to enable exhaustive narrowing. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingDiscriminant", []>) {
    return {
      TSUnionType(node) {
        const typeLiterals = flattenUnionMembers(node.types).filter(
          (member): member is TSESTree.TSTypeLiteral =>
            member.type === "TSTypeLiteral",
        );

        if (typeLiterals.length < 2) return;

        const hasAnyDiscriminant = typeLiterals.some((member) =>
          member.members.some(
            (sig) =>
              sig.type === "TSPropertySignature" &&
              sig.typeAnnotation?.typeAnnotation?.type === "TSLiteralType" &&
              sig.typeAnnotation.typeAnnotation.literal.type === "Literal" &&
              (typeof sig.typeAnnotation.typeAnnotation.literal.value === "string" ||
                typeof sig.typeAnnotation.typeAnnotation.literal.value === "number" ||
                typeof sig.typeAnnotation.typeAnnotation.literal.value === "boolean"),
          ),
        );

        if (!hasAnyDiscriminant) {
          context.report({
            node,
            messageId: "missingDiscriminant",
            data: { url: URL },
          });
        }
      },
    };
  },
});
