import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

/**
 * Recursively checks whether an expression contains runtime-computed values.
 *
 * Considered **static** (returns `false`):
 * - `Literal` — string, number, boolean, null, RegExp literals
 * - `TemplateLiteral` with zero expressions — plain template strings
 * - `UnaryExpression` with `typeof` or `void` — always resolve to a known value
 * - `UnaryExpression` with `-` applied to a `Literal` — negated numeric/string literal
 * - `ObjectExpression` / `ArrayExpression` where every nested value is static
 *
 * Considered **dynamic** (returns `true`):
 * - `TemplateLiteral` with expressions — `${...}` interpolations
 * - `UnaryExpression` with any other operator (e.g., `!`, `~`, `+`, `++`, `--`)
 * - Any other expression type, including but not limited to:
 *   `Identifier`, `MemberExpression`, `CallExpression`, `NewExpression`,
 *   `BinaryExpression`, `LogicalExpression`, `ConditionalExpression`,
 *   `AwaitExpression`, `YieldExpression`, `TaggedTemplateExpression`,
 *   `ArrowFunctionExpression`, `FunctionExpression`, `ClassExpression`,
 *   `UpdateExpression`, `AssignmentExpression`, `SequenceExpression`,
 *   `Super`, `Import`, `MetaProperty`, `ChainExpression`, `JSX*`, `TS*`
 */
function hasDynamicValue(node: TSESTree.Expression | null | undefined): boolean {
  if (!node) return false;

  if (node.type === "Literal") return false;

  if (node.type === "TemplateLiteral") {
    return node.expressions.length > 0;
  }

  if (node.type === "UnaryExpression") {
    if (node.operator === "typeof") return false;
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
        "Disallow `as const` on objects or arrays that contain runtime-computed expressions — including identifiers, member access, function calls, binary/logical expressions, template literals with interpolations, await/yield, tagged templates, and other dynamically-evaluated sub-expressions",
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
