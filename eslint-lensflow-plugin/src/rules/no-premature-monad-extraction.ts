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
  if (node.callee.type === "MemberExpression") {
    const prop = node.callee.property;
    if (prop.type === "Identifier" && EXTRACT_METHODS.has(prop.name)) {
      return true;
    }
    if (
      node.callee.object.type === "Identifier" &&
      node.callee.property.type === "Identifier"
    ) {
      const nsKey = `${node.callee.object.name}.${node.callee.property.name}`;
      if (NS_EXTRACT_METHODS.has(nsKey)) {
        return true;
      }
    }
  }
  if (node.callee.type === "Identifier" && EXTRACT_METHODS.has(node.callee.name)) {
    return true;
  }
  return false;
}

function findPipeCall(node: TSESTree.CallExpression): TSESTree.CallExpression | null {
  let current = node;
  while (current) {
    if (
      current.type === "CallExpression" &&
      current.callee.type === "Identifier" &&
      current.callee.name === "pipe"
    ) {
      return current;
    }
    const parent = (current as any).parent;
    if (!parent) return null;
    if (parent.type === "CallExpression") {
      const idx = parent.arguments.indexOf(current);
      if (idx === -1) {
        return null;
      } else {
        current = parent;
      }
    } else {
      return null;
    }
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

        const pipeCall = findPipeCall(node);
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
