import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const resultPattern = /^(Result|Either|TaskEither)$/;

function getTypeRefName(node: TSESTree.TypeNode): string | null {
  if (node.type !== "TSTypeReference") return null;
  const tn = node.typeName;
  if (tn.type === "Identifier") return tn.name;
  return null;
}

function isResultType(name: string | null): boolean {
  return name !== null && resultPattern.test(name);
}

function findNestedResult(
  node: TSESTree.TypeNode,
): { outer: string; inner: string } | null {
  const outerName = getTypeRefName(node);
  const args = node.type === "TSTypeReference" && node.typeArguments
    ? node.typeArguments.params
    : undefined;

  if (!args) return null;

  const isOuterResult = isResultType(outerName);

  for (const arg of args) {
    const argName = getTypeRefName(arg);

    if (isOuterResult && isResultType(argName)) {
      return { outer: outerName!, inner: argName! };
    }

    const deeper = findNestedResult(arg);
    if (deeper) return deeper;
  }

  return null;
}

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

export default createRule({
  name: "no-nested-result-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow nested Result/Either return types that require double unwraps",
    },
    messages: {
      nestedResult:
        "Nested {{outer}}<...{{inner}}<...>> return type requires double unwraps. Flatten to a single-level error union instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nestedResult", []>) {
    function checkReturn(node: FunctionNode) {
      const returnAnnotation = node.returnType?.typeAnnotation;
      if (!returnAnnotation) return;

      const nested = findNestedResult(returnAnnotation);
      if (nested) {
        context.report({
          node: returnAnnotation,
          messageId: "nestedResult",
          data: {
            outer: nested.outer,
            inner: nested.inner,
          },
        });
      }
    }

    return {
      FunctionDeclaration(node) {
        checkReturn(node);
      },

      FunctionExpression(node) {
        checkReturn(node);
      },

      ArrowFunctionExpression(node) {
        checkReturn(node);
      },
    };
  },
});
