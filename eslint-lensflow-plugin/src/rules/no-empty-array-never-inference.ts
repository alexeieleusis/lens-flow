import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-empty-array-never-inference",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty array literals without explicit type annotation, which infer as never[]",
    },
    messages: {
      emptyArrayNoType:
        "Empty array literal without type annotation is inferred as never[]. Add an explicit type annotation (e.g. string[]) to avoid cryptic errors on push(). See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T34-never-bottom.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyArrayNoType", []>) {
    return {
      VariableDeclarator(node) {
        if (
          node.init?.type === "ArrayExpression" &&
          node.init.elements.length === 0 &&
          !node.id.typeAnnotation
        ) {
          context.report({
            node,
            messageId: "emptyArrayNoType",
          });
        }
      },
    };
  },
});
