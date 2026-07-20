import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T59-existential-types.md");

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function getObjectKeys(objExpr: TSESTree.ObjectExpression): string[] {
  const keys: string[] = [];
  for (const p of objExpr.properties) {
    if (p.type === "SpreadElement") continue;
    if (p.type !== "Property") continue;
    if (p.computed) continue;
    if (p.key.type === "Identifier") {
      keys.push(p.key.name);
    } else if (p.key.type === "Literal" && typeof p.key.value === "string") {
      keys.push(p.key.value);
    } else if (p.key.type === "Literal" && p.key.value != null) {
      keys.push(String(p.key.value));
    }
  }
  return keys;
}

function unwrapSatisfies(
  expr: TSESTree.Expression,
): TSESTree.Expression {
  return expr.type === "TSSatisfiesExpression" ? expr.expression : expr;
}

function findReturnStatements(fnNode: FunctionNode): TSESTree.ReturnStatement[] {
  const results: TSESTree.ReturnStatement[] = [];
  walk(fnNode.body, (node) => {
    if (
      node.type === "ReturnStatement" &&
      node.argument != null &&
      unwrapSatisfies(node.argument).type === "ObjectExpression"
    ) {
      results.push(node);
    }
  });
  return results;
}

export default createRule({
  name: "no-leaky-factory-return-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow factory functions returning object literals with properties beyond their declared interface",
    },
    messages: {
     leakyReturn:
         "Factory function returns object with extra properties {{extraProps}} not declared in interface {{interfaceName}}. Use `as {{interfaceName}}` cast to hide implementation details. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leakyReturn", []>) {
    const interfaces = new Map<string, Set<string>>();

    function checkObjectProps(
      nodeToReport: TSESTree.Node,
      objExpr: TSESTree.ObjectExpression,
      ifaceProps: Set<string>,
      interfaceName: string,
    ) {
      const objKeys = getObjectKeys(objExpr);
      const extraProps = objKeys.filter((k) => !ifaceProps.has(k));
      if (extraProps.length > 0) {
        context.report({
          node: nodeToReport,
          messageId: "leakyReturn",
          data: {
             extraProps: extraProps.join(", "),
             interfaceName,
             url: URL,
           },
        });
      }
    }

    function checkFunctionBody(
      fnNode: FunctionNode,
      ifaceProps: Set<string>,
      interfaceName: string,
    ) {
      if (fnNode.body.type === "BlockStatement") {
        for (const ret of findReturnStatements(fnNode)) {
          const objExpr = ret.argument ? unwrapSatisfies(ret.argument) : null;
          if (objExpr?.type !== "ObjectExpression") continue;
          checkObjectProps(ret, objExpr, ifaceProps, interfaceName);
        }
      } else if (fnNode.body.type === "ObjectExpression") {
        checkObjectProps(fnNode.body, fnNode.body, ifaceProps, interfaceName);
      }
    }

    function checkFunction(fnNode: FunctionNode) {
      const returnTypeAnn = fnNode.returnType?.typeAnnotation;
      if (returnTypeAnn?.type !== "TSTypeReference") return;
      if (returnTypeAnn.typeName.type !== "Identifier") return;

      const interfaceName = returnTypeAnn.typeName.name;
      const ifaceProps = interfaces.get(interfaceName);
      if (!ifaceProps) return;

      checkFunctionBody(fnNode, ifaceProps, interfaceName);
    }

    return {
      TSInterfaceDeclaration(node: TSESTree.TSInterfaceDeclaration) {
        const name = node.id.name;
        const props = new Set<string>();
        for (const member of node.body.body) {
          if (member.type !== "TSPropertySignature") continue;
          if (member.key.type === "Identifier") {
            props.add(member.key.name);
          } else if (member.key.type === "Literal") {
            props.add(String(member.key.value));
          }
        }
        interfaces.set(name, props);
      },
      FunctionDeclaration(node: TSESTree.FunctionDeclaration) {
        checkFunction(node);
      },
      FunctionExpression(node: TSESTree.FunctionExpression) {
        checkFunction(node);
      },
      ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
        checkFunction(node);
      },
    };
  },
});
