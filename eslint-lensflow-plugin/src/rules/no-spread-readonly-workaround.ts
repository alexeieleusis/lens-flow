import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-spread-readonly-workaround",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow spreading a readonly array into a mutable array to work around variance",
    },
    messages: {
      spreadReadonlyArray:
        "Spreading readonly array `{{name}}` into a new array is unnecessary. Change the callee parameter type from `Array<T>` to `readonly T[]`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"spreadReadonlyArray", []>) {
    return {
      CallExpression(node) {
        for (const arg of node.arguments) {
          if (
            arg.type === "ArrayExpression" &&
            arg.elements.length === 1 &&
            arg.elements[0]?.type === "SpreadElement" &&
            arg.elements[0].argument.type === "Identifier"
          ) {
            const spreadId = arg.elements[0].argument;
            const scope = context.sourceCode.getScope(spreadId);
            const variable = scope.variables.find(
              (v) => v.name === spreadId.name && v.defs.length > 0,
            );

            if (!variable) continue;

            const isReadonly = variable.defs.some((def) => {
              if (def.type !== "Variable") return false;
              const declarator = def.node;
              const id = declarator.id;
              if (id.type !== "Identifier") return false;
              if (!id.typeAnnotation) return false;
              const typeAnnNode = id.typeAnnotation.typeAnnotation;

              // readonly T[] → TSTypeOperator { operator: "readonly" }
              if (
                typeAnnNode.type === "TSTypeOperator" &&
                typeAnnNode.operator === "readonly"
              )
                return true;

              // ReadonlyArray<T>
              if (
                typeAnnNode.type === "TSTypeReference" &&
                typeAnnNode.typeName.type === "Identifier" &&
                typeAnnNode.typeName.name === "ReadonlyArray"
              )
                return true;

              return false;
            });

            if (isReadonly) {
              context.report({
                node: arg,
                messageId: "spreadReadonlyArray",
                data: { name: spreadId.name },
              });
            }
          }
        }
      },
    };
  },
});
