import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const EXTRACT_METHODS = new Set([
  "fold",
  "getOrElse",
  "getOrNull",
  "extract",
  "toOption",
  "toNullable",
  "fromEither",
  "fromOption",
  "fromIO",
]);

const NS_EXTRACT_METHODS = new Set([
  "O.getOrElse",
  "O.fold",
  "O.fromOption",
  "E.getOrElse",
  "E.fold",
  "E.fromEither",
  "TE.fold",
  "TE.fromIO",
  "W.getOrElse",
]);

function isExtractionCall(node: TSESTree.CallExpression): boolean {
  let callee = node.callee;
  if (callee.type === "ChainExpression") {
    callee = callee.expression;
  }
  if (callee.type === "MemberExpression") {
    const prop = callee.property;
    if (prop.type === "Identifier" && EXTRACT_METHODS.has(prop.name)) {
      return true;
    }
    if (
      callee.object.type === "Identifier" &&
      callee.property.type === "Identifier"
    ) {
      const nsKey = `${callee.object.name}.${callee.property.name}`;
      if (NS_EXTRACT_METHODS.has(nsKey)) {
        return true;
      }
    }
  }
  if (callee.type === "Identifier" && EXTRACT_METHODS.has(callee.name)) {
    return true;
  }
  return false;
}

function findPipeCall(
  node: TSESTree.CallExpression,
  context: TSESLint.RuleContext<string, []>,
): TSESTree.CallExpression | null {
  const ancestors = context.sourceCode.getAncestors(node);
  let target: TSESTree.Node = node;

  for (const ancestor of ancestors) {
    if (ancestor.type !== "CallExpression") return null;
    const idx = ancestor.arguments.indexOf(target as TSESTree.Expression);
    if (idx === -1) return null;

    if (
      ancestor.callee.type === "Identifier" &&
      ancestor.callee.name === "pipe"
    ) {
      return ancestor;
    }
    target = ancestor;
  }
  return null;
}

export default createRule({
  name: "no-premature-monad-extraction",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow extracting plain values from monadic contexts mid-pipeline",
    },
    messages: {
      prematureExtraction:
        "Extracting a value from a monadic context mid-pipeline loses type safety and prevents error propagation. Use chain/map and extract only at the final step. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T54-functor-applicative-monad.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"prematureExtraction", []>) {
    return {
      CallExpression(node) {
        if (!isExtractionCall(node)) return;

        const pipeCall = findPipeCall(node, context);
        if (pipeCall) {
          const lastArg = pipeCall.arguments[pipeCall.arguments.length - 1];
          if (lastArg !== node) {
            context.report({
              node,
              messageId: "prematureExtraction",
            });
          }
        }
      },
    };
  },
});
