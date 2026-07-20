import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
  while (
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "ChainExpression"
  ) {
    node = node.expression;
  }
  return node;
}

function isFuncNode(node: TSESTree.Node): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function hasStringParam(
  func: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
  paramName: string,
): boolean {
  for (const param of func.params) {
    if (param.type === "Identifier" && param.name === paramName) {
      return param.typeAnnotation?.typeAnnotation?.type === "TSStringKeyword";
    }
  }
  return false;
}

function isStringParamInEnclosingFunction(
  node: TSESTree.Node,
  paramName: string,
): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (isFuncNode(current)) {
      return hasStringParam(current, paramName);
    }
    current = current.parent;
  }
  return false;
}

export default createRule({
  name: "no-runtime-string-concat-for-typed-keys",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime string concatenation for object property keys when the source parameter is an untyped string",
    },
    messages: {
      runtimeStringConcatKey:
        "Property key constructed from untyped string parameter '{{param}}' at runtime. Use a literal union type for the parameter and a compile-time template literal type for the key. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          tableNames: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [
    {
      tableNames: ["handlers", "dispatchers", "mappings", "registry"],
    },
  ],
  create(context: TSESLint.RuleContext<"runtimeStringConcatKey", [{ tableNames: string[] }]>) {
    const { tableNames } = context.options[0] ?? {
      tableNames: ["handlers", "dispatchers", "mappings", "registry"],
    };
    const regexReplace = String.raw`\$&`;
    const tablePattern = new RegExp(
      `^(${tableNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, regexReplace)).join("|")})$`,
    );

    return {
      MemberExpression(node) {
        const unwrapped = unwrapExpression(node.property);
        if (unwrapped.type !== "TemplateLiteral") return;
        const tmpl = unwrapped;
        if (tmpl.expressions.length !== 1) return;

        if (node.object.type !== "Identifier") return;
        if (!tablePattern.test(node.object.name)) return;

        const tmplExpr = tmpl.expressions[0];
        if (tmplExpr.type !== "Identifier") return;

        if (!isStringParamInEnclosingFunction(node, tmplExpr.name)) return;

        context.report({
          node: tmpl,
          messageId: "runtimeStringConcatKey",
          data: { param: tmplExpr.name, url: URL },
        });
      },
    };
  },
});
