import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-union-without-common-shape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow union types whose members share no common properties",
    },
    messages: {
      noCommonShape:
        "Union members share no common properties, so no property is safely accessible without narrowing. Add a common discriminant or restructure the union. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T02-union-intersection.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noCommonShape", []>) {
    return {
      TSUnionType(node) {
        const typeLiterals = node.types.filter(
          (t): t is import("@typescript-eslint/types").TSESTree.TSTypeLiteral =>
            t.type === "TSTypeLiteral",
        );

        if (typeLiterals.length < 2) return;

        const propertySets = typeLiterals.map((member) => {
          const names = new Set<string>();
          for (const m of member.members) {
            if (m.type === "TSPropertySignature") {
              if (m.key.type === "Identifier") {
                names.add(m.key.name);
              } else if (m.key.type === "Literal" && typeof m.key.value === "string") {
                names.add(m.key.value);
              }
            }
          }
          return names;
        });

        const intersection = propertySets.reduce<Set<string>>(
          (acc, set) => new Set([...acc].filter((x) => set.has(x))),
          propertySets[0],
        );

        if (intersection.size === 0) {
          context.report({
            node,
            messageId: "noCommonShape",
          });
        }
      },
    };
  },
});
