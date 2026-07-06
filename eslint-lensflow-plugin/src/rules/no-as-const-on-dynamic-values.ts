import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function hasDynamicValue(node: TSESTree.Expression | null | undefined): boolean {
  if (!node) return false;

  if (node.type === "Literal") return false;

  if (node.type === "TemplateLiteral") {
    return node.expressions.length > 0;
  }

  if (node.type === "UnaryExpression") {
    // typeof and void always produce static results; - is static only with literal operand
    if (node.operator === "typeof" || node.operator === "void") return false;
    return node.operator !== "-" || node.argument.type !== "Literal";
  }

  if (node.type === "ObjectExpression") {
    return node.properties.some((prop: TSESTree.Property | TSESTree.SpreadElement) => {
      if (prop.type === "SpreadElement") {
        return hasDynamicValue(prop.argument);
      }
      if (prop.computed && hasDynamicValue(prop.key)) return true;
      return hasDynamicValue(prop.value as TSESTree.Expression | null);
    });
  }

  if (node.type === "ArrayExpression") {
    return node.elements.some((el: TSESTree.SpreadElement | TSESTree.Expression | null) => {
      if (el?.type === "SpreadElement") return hasDynamicValue(el.argument);
      return hasDynamicValue(el);
    });
  }

  return true;
}

export default createRule({
  name: "no-as-const-on-dynamic-values",
  meta: {
    fixable: undefined,
    type: "problem",
    docs: {
      description:
        "Disallow `as const` on objects or arrays whose values are computed at runtime",
    },
    messages: {
      dynamicAsConst:
        "`as const` on a value with runtime-computed properties. The type system will treat these values as compile-time literals, which is misleading. Provide an explicit type annotation instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC06-immutability.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"dynamicAsConst", []>) {
    return {
      TSAsExpression(node) {
        const typeAnn = node.typeAnnotation;
        if (
          typeAnn.type !== "TSTypeReference" ||
          typeAnn.typeName.type !== "Identifier" ||
          typeAnn.typeName.name !== "const"
        ) {
          return;
        }

        const expr = node.expression;

        if (
          (expr.type === "ObjectExpression" || expr.type === "ArrayExpression") &&
          hasDynamicValue(expr)
        ) {
          context.report({
            node,
            messageId: "dynamicAsConst",
          });
        }
      },
    };
  },
});
