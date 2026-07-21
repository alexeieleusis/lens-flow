import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T54-functor-applicative-monad.md");

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
  node: TSESTree.Node,
  context: TSESLint.RuleContext<string, []>,
): TSESTree.CallExpression | null {
  const ancestors = context.sourceCode.getAncestors(node);
  let target: TSESTree.Node = node;

  for (const ancestor of ancestors) {
    if (ancestor.type !== "CallExpression") continue;
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

function isExtractionIdentifier(node: TSESTree.Identifier): boolean {
  return EXTRACT_METHODS.has(node.name);
}

function isExtractionMemberExpression(
  node: TSESTree.MemberExpression,
): boolean {
  if (
    node.object.type === "Identifier" &&
    node.property.type === "Identifier"
  ) {
    const nsKey = `${node.object.name}.${node.property.name}`;
    return NS_EXTRACT_METHODS.has(nsKey);
  }
  return false;
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
        "Extracting a value from a monadic context mid-pipeline loses type safety and prevents error propagation. Use chain/map and extract only at the final step. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"prematureExtraction", []>) {
    const reportIfPremature = (node: TSESTree.Node) => {
      const pipeCall = findPipeCall(node, context);
      if (pipeCall) {
        const lastArg = pipeCall.arguments[pipeCall.arguments.length - 1];
        if (lastArg !== node) {
          context.report({
            node,
            messageId: "prematureExtraction",
            data: { url: URL },
          });
        }
      }
    };

    return {
      CallExpression(node) {
        if (!isExtractionCall(node)) return;
        reportIfPremature(node);
      },
      Identifier(node) {
        if (!isExtractionIdentifier(node)) return;
        reportIfPremature(node);
      },
      MemberExpression(node) {
        if (!isExtractionMemberExpression(node)) return;
        reportIfPremature(node);
      },
    };
  },
});
