import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/types";

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
        "Found {{count}} typestate marker types ({{markers}}). This creates 2^{{count}} = {{combinations}} possible states. Use Partial<T> + spread instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC09-builder-config.md",
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
  create(context: TSESLint.RuleContext<"excessiveMarkers", [{ maxMarkers?: number }]>) {
    const [{ maxMarkers: maxMarkersOpt } = {}] = context.options ?? [];
    const maxMarkers = maxMarkersOpt ?? 4;

    const markers: Array<{ node: TSESTree.TSTypeAliasDeclaration; name: string }> = [];

    return {
      TSTypeAliasDeclaration(node) {
        const aliasName = node.id.name;
        const ann = node.typeAnnotation;

        // Check for TSTypeReference where the alias name matches
        // phantom state naming: /^With[A-Z]/ or /^No[A-Z]/, but only
        // when the referenced type is meaningful (not a primitive).
        if (ann?.type === "TSTypeReference") {
          if (/^(With|No)[A-Z]/.test(aliasName)) {
            const refName = ann.typeName.type === "Identifier" ? ann.typeName.name : "";
            if (!PRIMITIVES.has(refName)) {
              markers.push({ node, name: aliasName });
              return;
            }
          }
        }

        // Check for TSTypeLiteral with exactly one TSPropertySignature
        // that has computed: true and a TSLiteralType value
        if (ann?.type === "TSTypeLiteral") {
          const members = ann.members;
          if (members.length === 1) {
            const member = members[0];
            if (
              member.type === "TSPropertySignature" &&
              member.computed === true &&
              member.key.type === "Literal"
            ) {
              markers.push({ node, name: aliasName });
            }
          }
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
            },
          });
        }
      },
    };
  },
});
