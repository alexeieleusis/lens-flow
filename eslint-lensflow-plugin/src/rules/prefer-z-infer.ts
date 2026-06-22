import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function isZInferType(node: unknown): boolean {
  if (
    node &&
    typeof node === "object" &&
    "type" in node &&
    (node as { type: string }).type === "TSTypeReference"
  ) {
    const tsRef = node as any;
    const typeName = tsRef.typeName;

    const isMemberInfer =
      typeName.type === "TSQualifiedName" &&
      typeName.right?.type === "Identifier" &&
      typeName.right?.name === "infer";
    const isDirectInfer =
      typeName.type === "Identifier" && typeName.name === "infer";

    if (!isMemberInfer && !isDirectInfer) return false;

    if (!tsRef.typeParameters?.params.length) return false;

    const typeParam = tsRef.typeParameters.params[0];
    if (
      typeParam &&
      typeof typeParam === "object" &&
      "type" in typeParam &&
      typeParam.type === "TSTypeQuery"
    ) {
      return true;
    }
  }
  return false;
}

function containsTypeLiteral(node: unknown): boolean {
  if (!node || typeof node !== "object" || !("type" in node)) return false;
  const t = (node as { type: string }).type;

  if (t === "TSTypeLiteral") return true;

  if (t === "TSUnionType") {
    const unionNode = node as any;
    return unionNode.types.some(containsTypeLiteral);
  }

  if (t === "TSIntersectionType") {
    const interNode = node as any;
    return interNode.types.some(containsTypeLiteral);
  }

  return false;
}

export default createRule({
  name: "prefer-z-infer",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `z.infer<typeof Schema>` over manually written object types that duplicate a nearby Zod schema.",
    },
    messages: {
      preferInfer:
        "Type alias `{{typeName}}` duplicates schema `{{schemaName}}`. Use `type {{typeName}} = z.infer<typeof {{schemaName}}>` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T06-derivation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferInfer", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const typeName = node.id.name;
        const schemaVarName = `${typeName}Schema`;

        const typeAnnotation = node.typeAnnotation;

        if (isZInferType(typeAnnotation)) return;

        if (!containsTypeLiteral(typeAnnotation)) return;

        const scope = context.sourceCode.getScope(node) as any;
        let currentScope = scope;
        let found = false;

        while (currentScope && !found) {
          const hasSchema = currentScope.variables.some(
            (v: any) => v.name === schemaVarName,
          );
          if (hasSchema) {
            found = true;
          }
          currentScope = currentScope.upper;
        }

        if (found) {
          context.report({
            node,
            messageId: "preferInfer",
            data: {
              typeName,
              schemaName: schemaVarName,
            },
          });
        }
      },
    };
  },
});
