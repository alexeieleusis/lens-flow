import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const STAGE3_CONTEXT_TYPES = new Set([
  "ClassDecoratorContext",
  "ClassMethodDecoratorContext",
  "ClassAccessorDecoratorContext",
  "ClassFieldDecoratorContext",
]);

function isStage3ContextType(param: TSESTree.Parameter): boolean {
  const inner = param.type === "TSParameterProperty"
    ? param.parameter
    : param.type === "AssignmentPattern"
    ? param.left
    : param;
  if (!inner.typeAnnotation) return false;
  const typeAnn = inner.typeAnnotation.typeAnnotation;
  if (typeAnn.type === "TSTypeReference") {
    const typeNode = typeAnn.typeName;
    if (typeNode.type === "Identifier") {
      return STAGE3_CONTEXT_TYPES.has(typeNode.name);
    }
    if (typeNode.type === "TSQualifiedName") {
      return STAGE3_CONTEXT_TYPES.has(typeNode.right.name);
    }
  }
  return false;
}

function extractDecoratorName(
  expr: TSESTree.Expression,
): string | null {
  if (expr.type === "Identifier") {
    return expr.name;
  }
  if (expr.type === "CallExpression") {
    const callee = expr.callee;
    if (callee.type === "Identifier") return callee.name;
  }
  return null;
}

export default createRule({
  name: "no-mixed-decorator-apis",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mixing stage-3 and experimental decorator APIs in the same file",
    },
    messages: {
      mixedDecoratorApis:
        "Class '{{name}}' mixes stage-3 and experimental decorator APIs. Use only one decorator API consistently. Stage-3 decorators: {{stage3Decos}}. Experimental decorators: {{experimentalDecos}}. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mixedDecoratorApis", []>) {
    const stage3DecoratorNames = new Set<string>();

    function visitDecoratorFunc(node: TSESTree.FunctionDeclaration) {
      if (!node.id) return;
      const hasStage3Context = node.params.some(isStage3ContextType);
      if (hasStage3Context) {
        stage3DecoratorNames.add(node.id.name);
      }
    }

    return {
      FunctionDeclaration: visitDecoratorFunc,

      "ClassDeclaration[decorators.length>0], ClassExpression[decorators.length>0]"(
        node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
      ) {
        const stage3Used = new Set<string>();
        const experimentalUsed = new Set<string>();

        for (const deco of node.decorators) {
          const decoName = extractDecoratorName(deco.expression);
          if (decoName !== null) {
            if (stage3DecoratorNames.has(decoName)) {
              stage3Used.add(decoName);
            } else {
              experimentalUsed.add(decoName);
            }
          }
        }

        if (stage3Used.size > 0 && experimentalUsed.size > 0) {
          context.report({
            node,
            messageId: "mixedDecoratorApis",
            data: {
              name: (node.id?.name ?? "<anonymous>"),
              stage3Decos: [...stage3Used].join(", "),
              experimentalDecos: [...experimentalUsed].join(", "),
            },
          });
        }
      },
    };
  },
});
