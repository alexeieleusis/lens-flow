import { TSESTree, TSESLint } from '@typescript-eslint/utils';
import { createRule } from "../utils/rule-creator.js";

const NAMESPACE_SEPARATORS = [":", "."];

function hasNamespacePattern(value: string): boolean {
  return NAMESPACE_SEPARATORS.some((sep) => value.includes(sep));
}

function findEnclosingFunction(
  node: TSESTree.Node,
):
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | null {
  let current: TSESTree.Node | undefined = node;
  while (current) {
    if (
      current.type === "FunctionDeclaration" ||
      current.type === "FunctionExpression" ||
      current.type === "ArrowFunctionExpression"
    ) {
      return current as
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression;
    }
    current = current.parent;
  }
  return null;
}

export default createRule({
  name: "no-magic-string-switch",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow switch statements on plain string parameters with namespaced case values — use a template literal discriminated union type instead",
    },
    messages: {
      magicStringSwitch:
        "Switch on plain string parameter with namespaced case values ({{values}}). Define a template literal discriminated union type for the parameter instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T63-template-literal-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicStringSwitch", []>) {
    return {
      SwitchStatement(node) {
        const discriminant = node.discriminant;
        if (discriminant.type !== "Identifier") return;

        const paramName = discriminant.name;
        const func = findEnclosingFunction(node);
        if (!func) return;

        const params = func.params;
        const param = params.find(
          (p) =>
            p.type === "Identifier" &&
            p.name === paramName &&
            p.typeAnnotation?.typeAnnotation.type === "TSStringKeyword",
        );
        if (!param) return;

        const stringCases = node.cases
          .filter((c) => c.test?.type === "Literal" && typeof c.test.value === "string")
          .map((c) => (c.test as TSESTree.StringLiteral).value);

        const namespacedCases = stringCases.filter(hasNamespacePattern);

        if (namespacedCases.length >= 2) {
          context.report({
            node,
            messageId: "magicStringSwitch",
            data: {
              values: namespacedCases.join(", "),
            },
          });
        }
      },
    };
  },
});
