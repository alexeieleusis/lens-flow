import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

const CONSTRAINT_PATTERNS = [
  /"(?:\w+)"\s*\|/,
  /'(?:\w+)'\s*\|/,
  /\bmust\b.*?(?:be|one of|only|either)/i,
  /\brequired\s+when\b/i,
  /\b(?:valid|allowed|accepted)\s+(?:values?|options?|choices?)?\s*:?\s*["']/i,
];

function isBroadPrimitive(
  typeAnnotation: TSESTree.TypeNode | undefined,
): boolean {
  if (!typeAnnotation) return false;
  return (
    typeAnnotation.type === "TSStringKeyword" ||
    typeAnnotation.type === "TSNumberKeyword"
  );
}

export default createRule({
  name: "no-jsdoc-constraint-spec",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow JSDoc comments that document value constraints on broad primitive types instead of encoding them in the type system",
    },
    messages: {
      jsdocConstraint:
        "Do not document value constraints in JSDoc comments. Encode the constraint as a literal type union or discriminated union instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC01-invalid-states.md",
      jsdocConditionalField:
        "Do not document conditional field requirements in comments. Use a discriminated union with literal types instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC01-invalid-states.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"jsdocConstraint" | "jsdocConditionalField", []>) {
    function hasConstraintComments(node: TSESTree.TSPropertySignature): {
      isConditional: boolean;
    } | null {
      const commentLines = context.sourceCode.getCommentsBefore(node);
      const commentText = commentLines.map((c) => c.value).join(" ").replace(/\s+/g, " ");

      const isConditional = /\brequired\s+when\b/i.test(commentText);

      for (const pattern of CONSTRAINT_PATTERNS) {
        if (pattern.test(commentText)) {
          return { isConditional };
        }
      }

      return null;
    }

    return {
      TSPropertySignature(node) {
        if (isBroadPrimitive(node.typeAnnotation?.typeAnnotation)) {
          const match = hasConstraintComments(node);
          if (match) {
            context.report({
              node,
              messageId: match.isConditional
                ? "jsdocConditionalField"
                : "jsdocConstraint",
            });
          }
        }
      },
    };
  },
});
