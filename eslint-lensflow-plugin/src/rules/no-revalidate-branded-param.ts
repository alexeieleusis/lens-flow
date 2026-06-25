import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";

const DOCS_URL = knowledgeUrl("catalog/T26-refinement-types.md");

const CONDITIONAL_TYPES = new Set<string>([
  "IfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ConditionalExpression",
]);

type ConditionalNode = Extract<
  TSESTree.Node,
  | TSESTree.IfStatement
  | TSESTree.WhileStatement
  | TSESTree.DoWhileStatement
  | TSESTree.ConditionalExpression
>;

function hasLengthAccess(root: TSESTree.Node, paramName: string): boolean {
  return walkNodes(root, (node) => {
    if (node.type !== "MemberExpression") return false;
    return (
      node.object.type === "Identifier" &&
      node.object.name === paramName &&
      node.property.type === "Identifier" &&
      node.property.name === "length"
    );
  });
}

function isRegexTestOnParam(node: TSESTree.Node, paramName: string): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "test" &&
    node.arguments.length >= 1 &&
    node.arguments[0].type === "Identifier" &&
    node.arguments[0].name === paramName
  );
}

function isLengthCheckCondition(node: TSESTree.Node, paramName: string): boolean {
  if (!CONDITIONAL_TYPES.has(node.type)) return false;
  return hasLengthAccess((node as ConditionalNode).test, paramName);
}

function isBranded(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const apparent = checker.getApparentType(tsType);
  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length <= 1) return false;

  for (const constituent of constituents) {
    const props = constituent.getProperties();
    for (const prop of props) {
      const propType = checker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration!,
      );
      if (
        (propType.flags & ts.TypeFlags.UniqueESSymbol) !== 0 &&
        propType.symbol
      ) {
        return true;
      }
    }
  }
  return false;
}

function checkRegexAndLength(
  root: TSESTree.Node,
  paramName: string,
  onReport: (node: TSESTree.Node, issue: "regex" | "length") => void,
): void {
  let reportedRegex = false;
  let reportedLength = false;

  walk(root, (node) => {
    if (reportedRegex && reportedLength) return true;

    if (!reportedRegex && isRegexTestOnParam(node, paramName)) {
      onReport(node, "regex");
      reportedRegex = true;
    }
    if (!reportedLength && isLengthCheckCondition(node, paramName)) {
      onReport((node as ConditionalNode).test, "length");
      reportedLength = true;
    }
  });
}

export default createRule({
  name: "no-revalidate-branded-param",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow re-validating a function parameter that is already branded, as the brand guarantees validity at construction time.",
    },
    messages: {
      regexTest:
        "Redundant regex `.test()` on branded parameter `{{param}}`. The brand already guarantees validity at construction time. See: {{url}}",
      lengthCheck:
        "Redundant `.length` check on branded parameter `{{param}}`. The brand already guarantees validity at construction time. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"regexTest" | "lengthCheck", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    function checkFunction(funcNode: TSESTree.FunctionLike): void {
      const body = funcNode.body;
      if (!body) return;

      const brandedParams = new Map<string, TSESTree.Identifier>();
      for (const param of funcNode.params || []) {
        if (param.type !== "Identifier") continue;
        const tsNode = esTreeNodeToTSNodeMap.get(param);
        if (!tsNode) continue;
        const tsType = checker.getTypeAtLocation(tsNode);
        if (isBranded(checker, tsType)) {
          brandedParams.set(param.name, param);
        }
      }

      if (brandedParams.size === 0) return;

      for (const paramName of brandedParams.keys()) {
        checkRegexAndLength(body, paramName, (node, issue) => {
          context.report({
            node,
            messageId: issue === "regex" ? "regexTest" : "lengthCheck",
            data: { param: paramName, url: DOCS_URL },
          });
        });
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node);
      },
      FunctionExpression(node) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node);
      },
    };
  },
});
