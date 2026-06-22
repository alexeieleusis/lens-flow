import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T26-refinement-types.md");

function hasLengthAccess(node: any, paramName: string): boolean {
  if (!node || typeof node !== "object") return false;

  if (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === paramName &&
    node.property.type === "Identifier" &&
    node.property.name === "length"
  ) {
    return true;
  }

  const keys = Object.keys(node).filter((k) => k !== "parent");
  for (const key of keys) {
    const child = node[key];
    if (Array.isArray(child)) {
      if (child.some((c) => hasLengthAccess(c, paramName))) return true;
    } else if (child && typeof child === "object") {
      if (hasLengthAccess(child, paramName)) return true;
    }
  }
  return false;
}

function isRegexTestOnParam(node: any, paramName: string): boolean {
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

function isLengthCheckCondition(node: any, paramName: string): boolean {
  const conditionalTypes = new Set([
    "IfStatement",
    "WhileStatement",
    "DoWhileStatement",
    "ConditionalExpression",
  ]);
  if (!conditionalTypes.has(node.type)) return false;
  return !!(node.test && hasLengthAccess(node.test, paramName));
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
  root: any,
  paramName: string,
  onReport: (node: any, issue: "regex" | "length") => void,
): void {
  let reportedRegex = false;
  let reportedLength = false;

  function walkChildren(node: any): void {
    const keys = Object.keys(node).filter((k) => k !== "parent");
    for (const key of keys) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          walk(item);
        }
      } else if (child && typeof child === "object") {
        walk(child);
      }
    }
  }

  function walk(node: any): void {
    if (!node || typeof node !== "object") return;
    if (reportedRegex && reportedLength) return;

    if (
      !reportedRegex &&
      isRegexTestOnParam(node, paramName)
    ) {
      onReport(node, "regex");
      reportedRegex = true;
    }
    if (
      !reportedLength &&
      isLengthCheckCondition(node, paramName)
    ) {
      onReport(node.test, "length");
      reportedLength = true;
    }
    if (reportedRegex && reportedLength) return;

    walkChildren(node);
  }

  walk(root);
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
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    function checkFunction(funcNode: any): void {
      const body = funcNode.body;
      if (!body) return;

      const brandedParams = new Map<string, any>();
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
            data: { param: paramName, url: URL },
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
