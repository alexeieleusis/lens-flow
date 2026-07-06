import { type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md";

function getMemberCallee(node: TSESTree.CallExpression): TSESTree.MemberExpression | null {
  let callee = node.callee;
  if (callee.type === "ChainExpression") callee = callee.expression;
  if (callee.type === "MemberExpression") return callee;
  return null;
}

function isJsonParseCall(node: TSESTree.CallExpression): boolean {
  const callee = getMemberCallee(node);
  if (!callee) return false;
  return (
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "JSON" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "parse"
  );
}

function isCastToUnknown(node: TSESTree.TSAsExpression): boolean {
  return node.typeAnnotation.type === "TSUnknownKeyword";
}

export default createRule({
  name: "require-unknown-after-json-parse",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `JSON.parse` results to be cast to `unknown` or assigned to an `unknown`-typed variable before further use.",
    },
    messages: {
      missingUnknownCast:
        "JSON.parse returns `any`. Cast the result to `unknown` to establish a trust boundary before narrowing. See: " +
        KNOWLEDGE_URL,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingUnknownCast", []>) {
    return {
      CallExpression(node) {
        if (!isJsonParseCall(node)) return;

        let parent: TSESTree.Node = node.parent;
        while (parent.type === "TSNonNullExpression") {
          parent = parent.parent;
        }

        if (parent.type === "TSAsExpression" && isCastToUnknown(parent)) {
          return;
        }

        if (
          parent.type === "TSSatisfiesExpression" &&
          parent.typeAnnotation.type === "TSUnknownKeyword"
        ) {
          return;
        }

        if (
          parent.type === "VariableDeclarator" &&
          parent.id.typeAnnotation?.typeAnnotation.type === "TSUnknownKeyword"
        ) {
          return;
        }

        context.report({
          node,
          messageId: "missingUnknownCast",
        });
      },
    };
  },
});
