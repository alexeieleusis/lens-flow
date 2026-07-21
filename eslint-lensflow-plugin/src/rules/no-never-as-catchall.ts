import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T34-never-bottom.md");

function isInsideDefaultSwitchCase(node: TSESTree.Node): boolean {
  let cur: TSESTree.Node | undefined = node.parent;
  while (cur) {
    if (cur.type === "SwitchCase" && cur.test === null) {
      return true;
    }
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      return false;
    }
    cur = cur.parent;
  }
  return false;
}

function isInsideElseBlock(node: TSESTree.Node): boolean {
  let cur: TSESTree.Node | undefined = node.parent;
  while (cur) {
    if (cur.type === "IfStatement") {
      if (cur.alternate && cur.alternate === node) {
        return true;
      }
      if (cur.alternate && containsNode(cur.alternate, node)) {
        return true;
      }
      continue;
    }
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      return false;
    }
    cur = cur.parent;
  }
  return false;
}

function containsNode(parent: TSESTree.Node, target: TSESTree.Node): boolean {
  const seen = new Set<TSESTree.Node>();
  function walk(node: TSESTree.Node): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    if (node === target) return true;
    for (const child of getChildren(node)) {
      if (walk(child)) return true;
    }
    return false;
  }
  return walk(parent);
}

export default createRule({
  name: "no-never-as-catchall",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using `never` as a variable or parameter type when the assigned value is not of type `never`.",
    },
    messages: {
      neverAsCatchall:
        "Variable is annotated as `never` but assigned a value of type `{{type}}`. Use `unknown` instead if the type is uncertain. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"neverAsCatchall", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkNeverAssignment(node: TSESTree.VariableDeclarator) {
      const typeAnnotation = node.id.typeAnnotation;
      if (!typeAnnotation) return;
      if (typeAnnotation.typeAnnotation.type !== "TSNeverKeyword") return;

      // Skip exhaustiveness patterns: default switch case or else block
      if (isInsideDefaultSwitchCase(node)) return;
      if (isInsideElseBlock(node)) return;

      const initExpr = node.init;
      if (!initExpr) return;

      const tsInitNode = parserServices.esTreeNodeToTSNodeMap.get(initExpr);
      if (!tsInitNode) return;

      const initType = checker.getTypeAtLocation(tsInitNode as ts.Expression);
      const typeName = checker.typeToString(initType);

      if (typeName !== "never") {
        context.report({
          node: typeAnnotation.typeAnnotation,
          messageId: "neverAsCatchall",
          data: {
            type: typeName,
            url: URL,
          },
        });
      }
    }

    function checkNeverParamProperty(node: TSESTree.TSParameterProperty) {
      const base = node.parameter;
      let id: TSESTree.Identifier | null = null;
      if (base.type === "AssignmentPattern") {
        if (!base.right) return;
        if (base.left.type === "Identifier") id = base.left;
        else return;
      } else if (base.type === "Identifier") {
        id = base;
      } else {
        return;
      }

      const typeAnnotation = id?.typeAnnotation;
      if (!typeAnnotation) return;
      if (typeAnnotation.typeAnnotation.type !== "TSNeverKeyword") return;

      const initExpr = base.type === "AssignmentPattern" ? base.right : null;
      if (!initExpr) return;

      const tsInitNode = parserServices.esTreeNodeToTSNodeMap.get(initExpr);
      if (!tsInitNode) return;

      const initType = checker.getTypeAtLocation(tsInitNode as ts.Expression);
      const typeName = checker.typeToString(initType);

      if (typeName !== "never") {
        context.report({
          node: typeAnnotation.typeAnnotation,
          messageId: "neverAsCatchall",
          data: {
            type: typeName,
            url: URL,
          },
        });
      }
    }

    return {
      VariableDeclarator: checkNeverAssignment,
      TSParameterProperty: checkNeverParamProperty,
    };
  },
});
