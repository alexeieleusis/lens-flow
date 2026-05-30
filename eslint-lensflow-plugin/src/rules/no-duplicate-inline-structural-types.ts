import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type Entry = {
  canonical: string;
  node: TSESTree.TSTypeLiteral;
};

function serializeTypeAnnotation(node: TSESTree.TSTypeAnnotation): string {
  if (node.typeAnnotation) {
    return node.typeAnnotation.type;
  }
  return "unknown";
}

function canonicalize(node: TSESTree.TSTypeLiteral): string {
  const members = node.members
    .filter(
      (m): m is TSESTree.TSPropertySignature =>
        m.type === "TSPropertySignature",
    )
    .map((m) => {
      let key: string;
      if (m.key.type === "Identifier") {
        key = m.key.name;
      } else {
        key = m.key.type === "Literal" ? String(m.key.value) : m.key.type;
      }
      const typeAnn = m.typeAnnotation
        ? serializeTypeAnnotation(m.typeAnnotation)
        : "unknown";
      return { key, type: typeAnn };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  return members.map((m) => `${m.key}:${m.type}`).join("|");
}

export default createRule({
  name: "no-duplicate-inline-structural-types",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow repeating the same inline structural type across multiple function parameters",
    },
    messages: {
      duplicateInlineType:
        "Duplicate inline structural type used {{count}} times. Extract this shape into a named interface or type alias. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minDuplicates: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minDuplicates: 3 }],
  create(context: TSESLint.RuleContext<"duplicateInlineType", [{ minDuplicates: number }]>) {
    const [{ minDuplicates } = { minDuplicates: 3 }] = context.options ?? [];
    const entries: Entry[] = [];

    function checkParams(
      params: ReadonlyArray<TSESTree.Parameter>,
    ) {
      for (const param of params) {
        if (
          param.type === "Identifier" &&
          param.typeAnnotation?.typeAnnotation.type === "TSTypeLiteral"
        ) {
          const lit = param.typeAnnotation.typeAnnotation;
          entries.push({
            canonical: canonicalize(lit),
            node: lit,
          });
        } else if (
          param.type === "AssignmentPattern" &&
          param.left.type === "Identifier" &&
          param.left.typeAnnotation?.typeAnnotation.type === "TSTypeLiteral"
        ) {
          const lit = param.left.typeAnnotation.typeAnnotation;
          entries.push({
            canonical: canonicalize(lit),
            node: lit,
          });
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node.params);
      },
      FunctionExpression(node) {
        checkParams(node.params);
      },
      ArrowFunctionExpression(node) {
        checkParams(node.params);
      },
      "Program:exit"() {
        const groups = new Map<string, Entry[]>();
        for (const entry of entries) {
          const group = groups.get(entry.canonical) ?? [];
          group.push(entry);
          groups.set(entry.canonical, group);
        }

        for (const [, group] of groups) {
          if (group.length >= minDuplicates) {
            for (const entry of group) {
              context.report({
                node: entry.node,
                messageId: "duplicateInlineType",
                data: { count: String(group.length) },
              });
            }
          }
        }
      },
    };
  },
});
