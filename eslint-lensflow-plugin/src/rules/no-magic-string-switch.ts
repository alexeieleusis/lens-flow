import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T63-template-literal-types.md");

const NAMESPACE_SEPARATORS = [":", "."];

function hasNamespacePattern(value: string): boolean {
  return NAMESPACE_SEPARATORS.some((sep) => value.includes(sep));
}

function getParamIdentifier(p: TSESTree.Parameter): TSESTree.Identifier | null {
  if (p.type === "Identifier") return p;
  if (p.type === "AssignmentPattern" && p.left.type === "Identifier")
    return p.left;
  if (p.type === "RestElement" && p.argument.type === "Identifier")
    return p.argument;
  return null;
}

function unwrapTSType(type: TSESTree.TypeNode): TSESTree.TypeNode {
  while ((type as any).type === "TSParenthesizedType") {
    type = (type as any).typeAnnotation;
  }
  return type;
}

function findEnclosingFunction(
  node: TSESTree.Node,
  context: TSESLint.RuleContext<"magicStringSwitch", []>,
):
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | null {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i];
    if (
      a.type === "FunctionDeclaration" ||
      a.type === "FunctionExpression" ||
      a.type === "ArrowFunctionExpression"
    ) {
      return a as
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression;
    }
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
        "Switch on plain string parameter with namespaced case values ({{values}}). Define a template literal discriminated union type for the parameter instead. See: {{url}}",
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
        const func = findEnclosingFunction(node, context);
        if (!func) return;

        // Resolve the discriminant via scope analysis to avoid false positives
        // when a nested scope shadows the function parameter.
        const innerScope = context.sourceCode.getScope(discriminant);
        let binding = innerScope.set.get(paramName);
        if (!binding) {
          // Walk up the scope chain to find the binding
          let currentScope = innerScope.upper;
          while (currentScope && !binding) {
            binding = currentScope.set.get(paramName);
            currentScope = currentScope.upper;
          }
        }
        if (!binding) return;

        // Verify the binding's declaration is one of the function's string-typed parameters.
        const stringParamNames = new Set(
          func.params
            .map(getParamIdentifier)
            .filter(
              (id): id is TSESTree.Identifier =>
                id?.typeAnnotation?.typeAnnotation != null &&
                unwrapTSType(id.typeAnnotation.typeAnnotation).type ===
                  "TSStringKeyword",
            )
            .map((id) => id.name),
        );
        if (!stringParamNames.has(binding.name)) return;

        const stringCases = node.cases
          .filter(
            (c) =>
              c.test?.type === "Literal" && typeof c.test.value === "string",
          )
          .map((c) => (c.test as TSESTree.StringLiteral).value);

        const namespacedCases = stringCases.filter(hasNamespacePattern);

        if (namespacedCases.length >= 2) {
          context.report({
            node,
            messageId: "magicStringSwitch",
            data: {
              values: namespacedCases.join(", "),
              url: URL,
            },
          });
        }
      },
    };
  },
});
