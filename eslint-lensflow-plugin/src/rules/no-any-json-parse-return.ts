import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T13-null-safety.md");

export default createRule({
  name: "no-any-json-parse-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions that return `any` from a `JSON.parse` call, shadowing null safety at the untrusted data boundary.",
    },
    messages: {
      anyJsonParseReturn:
        "Function returns `any` from `JSON.parse`. Use a concrete return type and validate the parsed data. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyJsonParseReturn", []>) {
    function checkFunction(
      node:
        | TSESTree.TSFunctionType
        | TSESTree.TSDeclareFunction
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const returnType = "returnType" in node ? node.returnType : undefined;
      if (returnType?.typeAnnotation.type !== "TSAnyKeyword") {
        return;
      }

      let body: TSESTree.Node | null = null;

      if (node.type === "ArrowFunctionExpression") {
        body = node.body;
      } else if (node.type === "TSDeclareFunction") {
        return;
      } else if (node.type === "TSFunctionType") {
        return;
      } else if (node.body) {
        body = node.body;
      }

      if (!body) return;

      if (
        walkNodes(body, (node) => {
          if (node.type !== "CallExpression") return false;
          const ce = node;
          return (
            ce.callee.type === "MemberExpression" &&
            !ce.callee.computed &&
            ce.callee.property.type === "Identifier" &&
            ce.callee.property.name === "parse" &&
            ce.callee.object.type === "Identifier" &&
            ce.callee.object.name === "JSON"
          );
        })
      ) {
        context.report({
          node,
          messageId: "anyJsonParseReturn",
          data: { url: URL },
        });
      }
    }

    return {
      TSFunctionType(node) {
        checkFunction(node);
      },
      TSDeclareFunction(node) {
        checkFunction(node);
      },
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
