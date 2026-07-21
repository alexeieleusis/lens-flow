import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  deriveSchemaName,
  findVariableInScopeChain,
  looksLikeZodSchema,
} from "../utils/schema-inference-helper.js";

const URL = knowledgeUrl("catalog/T06-derivation.md");

function isZInferType(node: TSESTree.TypeNode): boolean {
  if (node.type !== "TSTypeReference") return false;

  const tsRef = node;
  const typeName = tsRef.typeName;

  const isMemberInfer =
    typeName.type === "TSQualifiedName" &&
    typeName.left.type === "Identifier" &&
    typeName.left.name === "z" &&
    typeName.right.type === "Identifier" &&
    typeName.right.name === "infer";
  const isDirectInfer =
    typeName.type === "Identifier" && typeName.name === "infer";

  if (!isMemberInfer && !isDirectInfer) return false;

  if (!tsRef.typeArguments?.params.length) return false;

  const typeParam = tsRef.typeArguments.params[0];
  if (typeParam.type === "TSTypeQuery") {
    return true;
  }

  return false;
}

function containsTypeLiteral(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSTypeLiteral") return true;

  if (node.type === "TSUnionType") {
    return node.types.some(containsTypeLiteral);
  }

  if (node.type === "TSIntersectionType") {
    return node.types.some(containsTypeLiteral);
  }

  return false;
}

export default createRule({
  name: "prefer-z-infer",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `z.infer<typeof Schema>` over manually written types or interfaces that duplicate a nearby Zod schema.",
    },
    messages: {
      preferInfer:
        "Type alias `{{typeName}}` duplicates schema `{{schemaName}}`. Use `type {{typeName}} = z.infer<typeof {{schemaName}}>` instead. See: {{url}}",
      redundantInterface:
        "Interface `{{interfaceName}}` is manually defined alongside schema `{{schemaName}}`. Derive the type with `type {{interfaceName}} = z.infer<typeof {{schemaName}}>` instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<"preferInfer" | "redundantInterface", []>,
  ) {
    return {
      TSTypeAliasDeclaration(node) {
        const aliasName = node.id.name;
        const schemaVarName = deriveSchemaName(aliasName);

        const typeAnnotation = node.typeAnnotation;
        if (!typeAnnotation) return;

        if (isZInferType(typeAnnotation)) return;

        if (!containsTypeLiteral(typeAnnotation)) return;

        const scope = context.sourceCode.getScope(node);
        const schemaVar = findVariableInScopeChain(scope, schemaVarName);
        if (!schemaVar || !looksLikeZodSchema(schemaVar)) return;

        context.report({
          node,
          messageId: "preferInfer",
          data: {
            typeName: aliasName,
            schemaName: schemaVarName,
            url: URL,
          },
        });
      },

      TSInterfaceDeclaration(node) {
        const interfaceName = node.id?.name;
        if (!interfaceName) return;

        const schemaVarName = deriveSchemaName(interfaceName);

        const scope = context.sourceCode.getScope(node);
        const schemaVar = findVariableInScopeChain(scope, schemaVarName);
        if (!schemaVar || !looksLikeZodSchema(schemaVar)) return;

        context.report({
          node,
          messageId: "redundantInterface",
          data: {
            interfaceName,
            schemaName: schemaVarName,
            url: URL,
          },
        });
      },
    };
  },
});
