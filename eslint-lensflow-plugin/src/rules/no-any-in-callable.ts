import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function isAnyType(node: unknown): boolean {
  const n = node as { typeAnnotation?: { typeAnnotation?: { type: string } } };
  return n.typeAnnotation?.typeAnnotation?.type === "TSAnyKeyword";
}

function getParamName(param: unknown): string {
  if ((param as { type: string }).type === "TSParameterProperty") {
    const inner = (param as { parameter: { name?: string } }).parameter;
    return inner.name || "unnamed";
  }
  if ((param as { type: string }).type === "AssignmentPattern") {
    const left = (param as { left: { name?: string } }).left;
    return left.name || "unnamed";
  }
  if ((param as { type: string; name?: string }).type === "Identifier") {
    return (param as { name: string }).name;
  }
  return "unnamed";
}

export default createRule({
  name: "no-any-in-callable",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` as a parameter or return type in callable signatures instead of a proper generic or explicit type.",
    },
    messages: {
      anyParam:
        "Parameter '{{name}}' is typed as `any`. Use a generic or explicit type to preserve type information. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md",
      anyReturn:
        "Return type is `any`. Use a generic or explicit return type to preserve type information. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function checkFunction(
      node:
        | {
            params: readonly unknown[];
            returnType?: { typeAnnotation?: { type: string } } | null;
            declare?: boolean;
          }
        | {
            params: readonly unknown[];
            returnType?: { typeAnnotation?: { type: string } } | null;
          },
    ) {
      if ((node as { declare?: boolean }).declare) {
        return;
      }

      for (const param of node.params) {
        if (isAnyType(param)) {
          const name = getParamName(param);
          context.report({
            node: param as any,
            messageId: "anyParam",
            data: { name },
          });
        }
      }

      if (
        node.returnType?.typeAnnotation?.type === "TSAnyKeyword"
      ) {
        context.report({
          node: node.returnType as any,
          messageId: "anyReturn",
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
      TSFunctionType(node) {
        checkFunction(node);
      },
    };
  },
});
