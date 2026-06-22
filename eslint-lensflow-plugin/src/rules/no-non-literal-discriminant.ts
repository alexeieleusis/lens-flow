import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const DOCS_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md";

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "code",
  "discriminant",
  "dtype",
  "t",
  "variant",
  "case",
  "flavor",
]);

type PropEntry = {
  sig: TSESTree.TSPropertySignature;
  propName: string;
  isWidened: boolean;
  widenedType: string;
};

function isWidenedType(typeAnn: TSESTree.TypeNode): boolean {
  return typeAnn.type === "TSStringKeyword" || typeAnn.type === "TSNumberKeyword";
}

function widenedTypeName(typeAnn: TSESTree.TypeNode): string {
  return typeAnn.type === "TSStringKeyword" ? "string" : "number";
}

export default createRule({
  name: "no-non-literal-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow discriminant-named properties (kind, type, status, etc.) in unions that use widened types (string, number) in some members while using literal types in others, when the property is present in all union members.",
    },
    messages: {
      nonLiteralDiscriminant:
        "Discriminant property `{{propName}}` uses widened type `{{type}}` instead of a literal type. Use a literal type so the union can be narrowed. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nonLiteralDiscriminant", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSUnionType(node) {
        const members = node.types;
        if (members.length < 2) return;

        const propMap = new Map<string, PropEntry[]>();

        for (const member of members) {
          const memberTsType = parserServices.getTypeAtNode(member);
          const props = memberTsType.getProperties();

          for (const prop of props) {
            const propName = prop.escapedName as string;
            const decl = prop.valueDeclaration;
            if (!decl) continue;

            const propType = checker.getTypeOfSymbolAtLocation(prop, decl);

            const isWidened =
              (propType.flags & ts.TypeFlags.StringKeyword) !== 0 ||
              (propType.flags & ts.TypeFlags.NumberKeyword) !== 0;

            const isLiteral =
              (propType.flags & ts.TypeFlags.StringLiteral) !== 0 ||
              (propType.flags & ts.TypeFlags.NumberLiteral) !== 0;

            if (!isWidened && !isLiteral) continue;

            const sigNode = parserServices.esTreeNodeToTSNodeMap.get(
              members[0],
            ) as TSESTree.TSPropertySignature;

            const entry: PropEntry = {
              sig: isWidened ? (decl as TSESTree.TSPropertySignature) : sigNode,
              propName,
              isWidened,
              widenedType: isWidened
                ? (propType.flags & ts.TypeFlags.StringKeyword) !== 0
                  ? "string"
                  : "number"
                : "",
            };

            const existing = propMap.get(propName);
            if (existing) {
              existing.push(entry);
            } else {
              propMap.set(propName, [entry]);
            }
          }
        }

        for (const [propName, entries] of propMap) {
          if (!DISCRIMINANT_NAMES.has(propName)) continue;
          if (entries.length < members.length) continue;
          const hasLiteral = entries.some((e) => !e.isWidened);
          const hasWidened = entries.some((e) => e.isWidened);
          if (!hasLiteral || !hasWidened) continue;

          for (const entry of entries) {
            if (!entry.isWidened) continue;
            context.report({
              node: entry.sig,
              messageId: "nonLiteralDiscriminant",
              data: { propName: entry.propName, type: entry.widenedType, url: DOCS_URL },
            });
          }
        }
      },
    };
  },
});
