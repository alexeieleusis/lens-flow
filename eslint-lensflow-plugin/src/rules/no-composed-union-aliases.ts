import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const RULE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T02-union-intersection.md";

export default createRule({
  name: "no-composed-union-aliases",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow type aliases that are unions of other union type aliases, which create nested union structure obscuring the full set of variants.",
     },
    messages: {
      composed:
        "Type alias '{{name}}' is a union of other union aliases, creating nested union structure that obscures the full set of variants. Flatten into a single union instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"composed", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    function analyzeUnionMember(member: TSESTree.TypeElement | TSESTree.TypeNode): { isUnion: boolean; refName: string } {
      if (member.type !== "TSTypeReference") return { isUnion: false, refName: "" };

      const memberTsType = parserServices.getTypeAtLocation(member);
      const isUnion = (memberTsType.flags & ts.TypeFlags.Union) !== 0;

      if (!isUnion) return { isUnion: false, refName: "" };

      const refName =
        member.typeName.type === "Identifier"
          ? member.typeName.name
          : "";

      return { isUnion: true, refName };
    }

    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSUnionType") return;

        const unionNode = node.typeAnnotation;
        const members = unionNode.types;

        if (members.length < 2) return;

        let hasUnionAlias = false;

        for (const member of members) {
          const { isUnion } = analyzeUnionMember(member);
          if (isUnion) { hasUnionAlias = true; break; }
        }

        if (hasUnionAlias) {
          context.report({
            node,
            messageId: "composed",
            data: {
              name: node.id.name,
              url: RULE_URL,
            },
          });
        }
      },
    };
  },
});
