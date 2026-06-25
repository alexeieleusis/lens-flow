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

function isSameBinding(
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier,
  paramId: TSESTree.Identifier,
): boolean {
  const scope = sourceCode.getScope(identifier);
  const variable = scope.variables.find(
    (v) => v.name === identifier.name,
  );
  if (!variable) return false;
  return variable.identifiers.includes(paramId);
}

function hasLengthAccess(
  root: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  paramId: TSESTree.Identifier,
): boolean {
  return walkNodes(root, (node) => {
    if (node.type !== "MemberExpression") return false;
    if (node.object.type !== "Identifier") return false;
    if (
      node.property.type === "Identifier" &&
      node.property.name === "length" &&
      isSameBinding(sourceCode, node.object, paramId)
    ) {
      return true;
    }
    return false;
  });
}

function isRegexTestOnParam(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  paramId: TSESTree.Identifier,
): boolean {
  if (
    node.type !== "CallExpression" ||
    node.callee.type !== "MemberExpression" ||
    node.callee.property.type !== "Identifier" ||
    node.callee.property.name !== "test" ||
    node.arguments.length < 1 ||
    node.arguments[0].type !== "Identifier"
  ) {
    return false;
  }
  return isSameBinding(sourceCode, node.arguments[0], paramId);
}

function isLengthCheckCondition(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  paramId: TSESTree.Identifier,
): boolean {
  if (!CONDITIONAL_TYPES.has(node.type)) return false;
  return hasLengthAccess((node as ConditionalNode).test, sourceCode, paramId);
}

function isBranded(checker: ts.TypeChecker, tsType: ts.Type): boolean {
  const apparent = checker.getApparentType(tsType);
  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length <= 1) return false;

  const brandNamePattern = /^__(brand|type|mark)$|^__\w+_brand$/;

  for (const constituent of constituents) {
    const props = constituent.getProperties();
    for (const prop of props) {
      const propName = prop.escapedName as string;
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

      if (
        brandNamePattern.test(propName) &&
        (propType.flags & ts.TypeFlags.StringLiteral) !== 0
      ) {
        return true;
      }
    }
  }
  return false;
}

function checkRegexAndLength(
  root: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
  paramName: string,
  paramId: TSESTree.Identifier,
  onReport: (node: TSESTree.Node, issue: "regex" | "length") => void,
): void {
  let reportedRegex = false;
  let reportedLength = false;

  walk(root, (node) => {
    if (reportedRegex && reportedLength) return true;

    if (!reportedRegex && isRegexTestOnParam(node, sourceCode, paramId)) {
      onReport(node, "regex");
      reportedRegex = true;
    }
    if (!reportedLength && isLengthCheckCondition(node, sourceCode, paramId)) {
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

    const sourceCode = context.sourceCode;

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

      for (const [paramName, paramId] of brandedParams) {
        checkRegexAndLength(body, sourceCode, paramName, paramId, (node, issue) => {
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
      MethodDefinition(node) {
        checkFunction(node.value);
      },
      TSDeclareFunction(node) {
        checkFunction(node);
      },
    };
  },
});
