import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T47-gradual-typing.md";

function isJsonParseCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "parse"
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
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      CallExpression(node) {
        if (!isJsonParseCall(node)) return;

        const callTs =
          parserServices.esTreeNodeToTSNodeMap.get(node);
        if (!callTs) return;

        const callType = checker.getTypeAtLocation(
          callTs as ts.Expression,
        );
        const callTypeStr = checker.typeToString(callType);

        if (callTypeStr !== "any") return;

        const parent = node.parent;

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
