import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk } from "../utils/ast-helpers.js";

function analyzeFunction(
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
  params: TSESTree.Parameter[],
  body: TSESTree.Node | null,
) {
  for (const param of params) {
    if (param.type !== "Identifier") continue;

    const paramName = param.name;
    const typeAnn = param.typeAnnotation?.typeAnnotation;
    if (typeAnn?.type !== "TSTypeLiteral") continue;

    if (!body) continue;

    const accessedProperties = new Set<string>();
    let hasBareCallArg = false;

    walk(body, (n) => {
      if (
        n.type === "MemberExpression" &&
        n.object.type === "Identifier" &&
        n.object.name === paramName
      ) {
        const { property, computed } = n;
        if (property.type === "Identifier" && !computed) {
          accessedProperties.add(property.name);
        } else if (
          property.type === "Literal" &&
          computed &&
          typeof property.value === "string"
        ) {
          accessedProperties.add(property.value);
        }
      }

      if (n.type === "CallExpression") {
        for (const arg of n.arguments) {
          if (arg.type === "Identifier" && arg.name === paramName) {
            hasBareCallArg = true;
          }
        }
      }
    });

    if (accessedProperties.size !== 1 || hasBareCallArg) continue;

    const propertyName = accessedProperties.values().next().value!;

    context.report({
      node: body,
      messageId: "preferPrimitive",
      data: {
        param: paramName,
        property: propertyName,
        type: "string",
      },
    });
  }
}

export default createRule({
  name: "prefer-primitive-method-params",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer primitive method parameters over object parameters when only a single property is extracted",
    },
    messages: {
      preferPrimitive:
        "Method accepts object `{{param}}` but only extracts `{{property}}`. Prefer `{{property}}: {{type}}` as a primitive parameter instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferPrimitive", []>) {
    return {
      MethodDefinition(node) {
        analyzeFunction(context, node.value.params, node.value.body);
      },

      FunctionDeclaration(node) {
        analyzeFunction(context, node.params, node.body);
      },

      FunctionExpression(node) {
        if (node.parent?.type === "MethodDefinition") return;
        analyzeFunction(context, node.params, node.body);
      },

      ArrowFunctionExpression(node) {
        analyzeFunction(context, node.params, node.body);
      },
    };
  },
});
