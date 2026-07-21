import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

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
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};
    const checker = program.getTypeChecker();
    function analyzeUnionMember(member: TSESTree.TypeNode): {
      isUnion: boolean;
      refName: string;
    } {
      let current = member;

      // If the unwrapped node is itself a union (e.g. (A | B)), recurse into its members
      if (current.type === "TSUnionType") {
        for (const inner of current.types) {
          const result = analyzeUnionMember(inner);
          if (result.isUnion) return result;
        }
        return { isUnion: false, refName: "" };
      }

      if (current.type !== "TSTypeReference")
        return { isUnion: false, refName: "" };

      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(current);
      if (!tsNode) return { isUnion: false, refName: "" };
      const memberTsType = checker.getTypeAtLocation(tsNode);
      const isUnion = (memberTsType.flags & ts.TypeFlags.Union) !== 0;

      if (!isUnion) return { isUnion: false, refName: "" };

      const refName =
        current.typeName.type === "Identifier" ? current.typeName.name : "";

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
          if (isUnion) {
            hasUnionAlias = true;
            break;
          }
        }

        if (hasUnionAlias) {
          context.report({
            node,
            messageId: "composed",
            data: {
              name: node.id.name,
              url: URL,
            },
          });
        }
      },
    };
  },
});
