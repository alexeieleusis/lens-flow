import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-truthiness-null-narrowing",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow truthiness checks for null/undefined narrowing when falsy values are valid type members",
    },
    messages: {
      truthinessNullNarrowing:
        "Using truthiness check on a variable whose type includes null/undefined and falsy values (0, \"\", false). Use !== null or != null instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T14-type-narrowing.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"truthinessNullNarrowing", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkNode(test: ts.Node): void {
      if (test.kind !== ts.SyntaxKind.Identifier) return;

      const testType = checker.getTypeAtLocation(test);
      const allTypes = testType.isUnion() ? testType.types : [testType];

      let hasNullable = false;
      let hasFalsy = false;

      for (const member of allTypes) {
        const flags = member.flags;
        if (flags & ts.TypeFlags.Null || flags & ts.TypeFlags.Undefined) hasNullable = true;
        if (
          flags & ts.TypeFlags.Number
          || flags & ts.TypeFlags.String
          || flags & ts.TypeFlags.Boolean
          || (flags & ts.TypeFlags.NumberLiteral && checker.typeToString(member) === "0")
          || (flags & ts.TypeFlags.StringLiteral && checker.typeToString(member) === "\"\"")
          || (flags & ts.TypeFlags.BooleanLiteral && checker.typeToString(member) === "false")
        ) {
          hasFalsy = true;
        }
      }

      if (hasNullable && hasFalsy) {
        const eslintNode = parserServices.tsNodeToESTreeNodeMap.get(test);
        if (eslintNode) {
          context.report({
            node: eslintNode,
            messageId: "truthinessNullNarrowing",
          });
        }
      }
    }

    return {
      IfStatement(node) {
        const tsTest = parserServices.esTreeNodeToTSNodeMap.get(node.test);
        if (tsTest) checkNode(tsTest);
      },

      LogicalExpression(node) {
        if (node.operator === "&&" || node.operator === "||") {
          const tsLeft = parserServices.esTreeNodeToTSNodeMap.get(node.left);
          if (tsLeft) checkNode(tsLeft);
        }
      },

      WhileStatement(node) {
        const tsTest = parserServices.esTreeNodeToTSNodeMap.get(node.test);
        if (tsTest) checkNode(tsTest);
      },

      DoWhileStatement(node) {
        const tsTest = parserServices.esTreeNodeToTSNodeMap.get(node.test);
        if (tsTest) checkNode(tsTest);
      },

      ConditionalExpression(node) {
        const tsTest = parserServices.esTreeNodeToTSNodeMap.get(node.test);
        if (tsTest) checkNode(tsTest);
      },
    };
  },
});
