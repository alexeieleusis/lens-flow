import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC13-state-machines.md");

function extractPropertyName(key: TSESTree.PropertyName): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

export default createRule({
  name: "require-literal-state-type",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce that `state` or `status` properties use a union of string literal types instead of bare `string`",
    },
    messages: {
      bareStringState:
        'Property `{{name}}` is typed as bare `string`. Use a union of string literal types (e.g. `"draft" | "review" | "approved"`) instead. See: {{url}}',
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"bareStringState", []>) {
    function checkMembers(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members: TSESTree.TypeElement[] =
        node.type === "TSInterfaceBody" ? node.body : node.members;
      for (const member of members) {
        if (member.type !== "TSPropertySignature") continue;

        const propName = extractPropertyName(member.key);
        if (!propName || !/^(state|status)$/.test(propName)) continue;

        const typeAnn = member.typeAnnotation?.typeAnnotation;
        if (!typeAnn) continue;

        if (typeAnn.type === "TSStringKeyword") {
          context.report({
            node: typeAnn,
            messageId: "bareStringState",
            data: { name: propName, url: URL },
          });
        }
      }
    }

    return {
      TSInterfaceBody: checkMembers,
      TSTypeLiteral: checkMembers,
    };
  },
});
