import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/types";

const URL = knowledgeUrl("usecases/UC09-builder-config.md");

const PRIMITIVES = new Set([
  "string",
  "number",
  "boolean",
  "any",
  "unknown",
  "void",
  "never",
  "null",
  "undefined",
  "object",
  "bigint",
  "symbol",
]);

export default createRule({
  name: "no-excessive-typestate-markers",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Flags 4+ typestate marker types for optional config fields; use Partial<T> + spread instead.",
    },
    messages: {
      excessiveMarkers:
        "Found {{count}} typestate marker types ({{markers}}). This creates 2^{{count}} = {{combinations}} possible states. Use Partial<T> + spread instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxMarkers: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxMarkers: 4 }],
  create(
    context: TSESLint.RuleContext<
      "excessiveMarkers",
      [{ maxMarkers?: number }]
    >,
  ) {
    const [{ maxMarkers: maxMarkersOpt } = {}] = context.options ?? [];
    const maxMarkers = maxMarkersOpt ?? 4;

    const markers: Array<{
      node: TSESTree.TSTypeAliasDeclaration;
      name: string;
    }> = [];

    const checkTypeReference = (node: TSESTree.TSTypeAliasDeclaration) => {
      const ann = node.typeAnnotation;
      if (ann?.type !== "TSTypeReference") return false;
      if (!/^(With|No)[A-Z]/.test(node.id.name)) return false;
      const refName =
        ann.typeName.type === "Identifier" ? ann.typeName.name : "";
      return !PRIMITIVES.has(refName);
    };

    const checkTypeLiteral = (node: TSESTree.TSTypeAliasDeclaration) => {
      const ann = node.typeAnnotation;
      if (ann?.type !== "TSTypeLiteral") return false;
      const members = ann.members;
      if (members.length !== 1) return false;
      const member = members[0];
      return (
        member.type === "TSPropertySignature" &&
        member.computed === true &&
        member.key.type === "Literal"
      );
    };

    return {
      TSTypeAliasDeclaration(node) {
        if (checkTypeReference(node) || checkTypeLiteral(node)) {
          markers.push({ node, name: node.id.name });
        }
      },
      "Program:exit"() {
        if (markers.length >= maxMarkers) {
          context.report({
            node: markers[0].node,
            messageId: "excessiveMarkers",
            data: {
              count: String(markers.length),
              markers: markers.map((m) => m.name).join(", "),
              combinations: String(Math.pow(2, markers.length)),
              url: URL,
            },
          });
        }
      },
    };
  },
});
