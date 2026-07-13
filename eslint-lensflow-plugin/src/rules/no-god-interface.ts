import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-god-interface",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces and type literals with too many optional properties or total properties.",
    },
    messages: {
      tooManyOptional:
        "Type '{{name}}' has {{optionalCount}} optional properties (max {{maxOptional}}). Consider splitting into smaller, focused types. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
      tooManyTotal:
        "Type '{{name}}' has {{totalCount}} total properties (max {{maxTotal}}). Consider splitting into smaller, focused types. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minOptionalFields: {
            type: "number",
            minimum: 1,
          },
          maxTotalFields: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minOptionalFields: 5, maxTotalFields: 8 }],
  create(context: TSESLint.RuleContext<"tooManyOptional" | "tooManyTotal", [{ minOptionalFields?: number, maxTotalFields?: number }]>) {
    const [{ minOptionalFields, maxTotalFields } = {}] =
      context.options ?? [];
    const thresholdOptional = minOptionalFields ?? 5;
    const thresholdTotal = maxTotalFields ?? 8;

    function checkBody(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members =
        node.type === "TSInterfaceBody" ? node.body : node.members;
      const properties = members.filter(
        (member): member is TSESTree.TSPropertySignature =>
          member.type === "TSPropertySignature",
      );
      const optionalCount = properties.filter((p) => p.optional).length;
      const totalCount = properties.length;

      const declarationAncestor = context.getAncestors().find(
        (a): a is TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration =>
          a.type === "TSInterfaceDeclaration" || a.type === "TSTypeAliasDeclaration",
      );

      const reportNode = declarationAncestor || node;
      const name = declarationAncestor ? (declarationAncestor.id ? declarationAncestor.id.name : "anonymous") : "anonymous";

      if (optionalCount > thresholdOptional) {
        context.report({
          node: reportNode,
          messageId: "tooManyOptional",
          data: {
            name,
            optionalCount: String(optionalCount),
            maxOptional: String(thresholdOptional),
          },
        });
      } else if (totalCount >= thresholdTotal) {
        context.report({
          node: reportNode,
          messageId: "tooManyTotal",
          data: {
            name,
            totalCount: String(totalCount),
            maxTotal: String(thresholdTotal),
          },
        });
      }
    }

    return {
      TSInterfaceBody: checkBody,
      TSTypeLiteral: checkBody,
    };
  },
});
