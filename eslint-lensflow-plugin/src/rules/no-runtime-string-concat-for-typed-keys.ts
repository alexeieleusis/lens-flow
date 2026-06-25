import { createRule } from "../utils/rule-creator.js";
import type { TSESTree, TSESLint } from "@typescript-eslint/utils";

function findEnclosingFunction(
  node: TSESTree.Node,
  context: TSESLint.RuleContext<string, unknown[]>,
): TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | null {
  const ancestors = context.sourceCode.getAncestors(node);
  for (const ancestor of ancestors) {
    if (
      ancestor.type === "FunctionDeclaration" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "ArrowFunctionExpression"
    ) {
      return ancestor as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
    }
  }
  return null;
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
        "Property key constructed from untyped string parameter '{{param}}' at runtime. Use a literal union type for the parameter and a compile-time template literal type for the key. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T63-template-literal-types.md",
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
        if (node.property.type !== "TemplateLiteral") return;
        const tmpl = node.property;
        if (tmpl.expressions.length !== 1) return;

        if (node.object.type !== "Identifier") return;
        if (!tablePattern.test(node.object.name)) return;

        const tmplExpr = tmpl.expressions[0];
        if (tmplExpr.type !== "Identifier") return;

        const func = findEnclosingFunction(node, context);
        if (!func) return;

        const params = func.params;
        for (const param of params) {
          if (param.type !== "Identifier") continue;
          if (param.name !== tmplExpr.name) continue;
          const typeAnn = param.typeAnnotation?.typeAnnotation;
          if (typeAnn?.type !== "TSStringKeyword") continue;

          context.report({
            node,
            messageId: "runtimeStringConcatKey",
            data: { param: param.name },
          });
          return;
        }
      },
    };
  },
});
