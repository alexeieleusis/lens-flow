import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T61-recursive-types.md");

export default createRule({
  name: "no-any-array-for-children",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any[]` on children/nested elements properties — use a self-referential type instead.",
    },
    messages: {
     anyArrayChildren:
         "Property \"{{propName}}\" uses `any[]` for a nested structure. Use a self-referential type (e.g. `{{parentName}}[]`) for structural type safety. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyArrayChildren", []>) {
    const nestedPattern = /^(children|nodes|items|elements|subs?)/i;

    return {
      TSPropertySignature(node) {
        let propName: string | undefined;

        if (node.key.type === "Identifier") {
          propName = node.key.name;
        } else if (node.key.type === "Literal" && typeof node.key.value === "string") {
          propName = node.key.value;
        }

        if (!propName || !nestedPattern.test(propName)) return;

        const typeAnn = node.typeAnnotation?.typeAnnotation;

        const isAnyArray =
          (typeAnn?.type === "TSArrayType" && typeAnn.elementType.type === "TSAnyKeyword") ||
          (typeAnn?.type === "TSTypeReference" &&
            typeAnn.typeName.type === "Identifier" &&
            typeAnn.typeName.name === "Array" &&
            typeAnn.typeArguments?.params?.[0]?.type === "TSAnyKeyword");

        if (!isAnyArray) return;

        let parentName = "the containing type";
        if (node.parent?.type === "TSTypeLiteral" || node.parent?.type === "TSInterfaceBody") {
          const grandParent = node.parent.parent;
          if (
            (grandParent?.type === "TSTypeAliasDeclaration" || grandParent?.type === "TSInterfaceDeclaration") &&
            grandParent.id.type === "Identifier"
          ) {
            parentName = grandParent.id.name;
          }
        }

        context.report({
          node,
          messageId: "anyArrayChildren",
          data: { propName, parentName, url: URL },
        });
      },
    };
  },
});
