import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function hasVarianceAnnotation(tp: TSESTree.TSTypeParameter): boolean {
  return !!(tp as TSESTree.TSTypeParameter & { out?: boolean; in?: boolean }).out || !!(tp as TSESTree.TSTypeParameter & { out?: boolean; in?: boolean }).in;
}

function extractTypeName(node: TSESTree.TSTypeReference): string | null {
  if (node.typeName.type === "Identifier") return node.typeName.name;
  if (node.typeName.type === "TSQualifiedName" && node.typeName.right.type === "Identifier")
    return node.typeName.right.name;
  return null;
}

function handleTypeReference(
  node: TSESTree.TSTypeReference,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  const name = extractTypeName(node);
  if (name === paramName) {
    if (covariant) result.covariant = true;
    else result.contravariant = true;
  }
}

// TSParenthesizedType isn't in AST_NODE_TYPES enum in this version of @typescript-eslint,
// so we handle it before the switch with a raw string check and typed cast.
function handleParenthesizedType(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  findTypeParamUsage(node.typeAnnotation, paramName, covariant, result);
}

function handleFunctionType(
  node: TSESTree.TSFunctionType | TSESTree.TSConstructorType,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  node.params.forEach((p) => {
    if ("typeAnnotation" in p && p.typeAnnotation)
      findTypeParamUsage(p.typeAnnotation, paramName, false, result);
  });
  findTypeParamUsage(node.returnType, paramName, true, result);
}

function handleArrayType(
  node: TSESTree.TSArrayType,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  findTypeParamUsage(node.elementType, paramName, covariant, result);
}

function handleTupleType(
  node: TSESTree.TSTupleType,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  node.elementTypes.forEach((el) =>
    findTypeParamUsage(el, paramName, covariant, result),
  );
}

function handleUnionOrIntersectionType(
  node: TSESTree.TSUnionType | TSESTree.TSIntersectionType,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  node.types.forEach((m) =>
    findTypeParamUsage(m, paramName, covariant, result),
  );
}

function handleTypeLiteral(
  node: TSESTree.TSTypeLiteral,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  node.members.forEach((m) =>
    findTypeParamUsage(m, paramName, covariant, result),
  );
}

function handleConditionalType(
  node: TSESTree.TSConditionalType,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  findTypeParamUsage(node.checkType, paramName, false, result);
  findTypeParamUsage(node.falseType, paramName, false, result);
  findTypeParamUsage(node.trueType, paramName, true, result);
}

function handleIndexedAccessType(
  node: TSESTree.TSIndexedAccessType,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  findTypeParamUsage(node.objectType, paramName, false, result);
  findTypeParamUsage(node.indexType, paramName, false, result);
}

function handlePropertySignature(
  node: TSESTree.TSPropertySignature,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  if (node.typeAnnotation) {
    findTypeParamUsage(node.typeAnnotation, paramName, true, result);
  }
}

function handleCallSignature(
  node: TSESTree.TSCallSignatureDeclaration,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  (node.params || []).forEach((p) => {
    if ("typeAnnotation" in p && p.typeAnnotation)
      findTypeParamUsage(p.typeAnnotation, paramName, false, result);
  });
  if (node.returnType) findTypeParamUsage(node.returnType.typeAnnotation, paramName, true, result);
}

function handleConstructSignature(
  node: TSESTree.TSConstructSignatureDeclaration,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  (node.params || []).forEach((p) => {
    if ("typeAnnotation" in p && p.typeAnnotation)
      findTypeParamUsage(p.typeAnnotation, paramName, false, result);
  });
  if (node.returnType) findTypeParamUsage(node.returnType.typeAnnotation, paramName, true, result);
}

function handleMethodSignature(
  node: TSESTree.TSMethodSignature,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  (node.params || []).forEach((p) => {
    if ("typeAnnotation" in p && p.typeAnnotation)
      findTypeParamUsage(p.typeAnnotation, paramName, false, result);
  });
  if (node.returnType) findTypeParamUsage(node.returnType.typeAnnotation, paramName, true, result);
}

function handleTypeAnnotation(
  node: TSESTree.TSTypeAnnotation,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  findTypeParamUsage(node.typeAnnotation, paramName, covariant, result);
}

function handleTypeQuery(
  node: TSESTree.TSTypeQuery,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  // typeof X<T> — variance depends on how the queried type uses its parameters.
  // Treating as invariant to avoid silent false negatives.
  findTypeParamUsage(node.exprName, paramName, true, result);
  findTypeParamUsage(node.exprName, paramName, false, result);
}

function handleTypeOperator(
  node: TSESTree.TSTypeOperator,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  if (node.operator === "keyof") {
    // keyof T — the operand is used contravariantly
    findTypeParamUsage(node.typeAnnotation, paramName, false, result);
  } else {
    // readonly preserves the original variance
    findTypeParamUsage(node.typeAnnotation, paramName, covariant, result);
  }
}

function handleMappedType(
  node: TSESTree.TSMappedType,
  paramName: string,
  result: { covariant: boolean; contravariant: boolean },
): void {
  // constraint (e.g., "K in keyof T") — bound is contravariant
  findTypeParamUsage(node.constraint, paramName, false, result);
  // typeAnnotation uses T covariantly
  if (node.typeAnnotation) {
    findTypeParamUsage(node.typeAnnotation, paramName, true, result);
  }
}

function handleImportType(
  node: TSESTree.TSImportType,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  // import("mod").Foo<T> — check type arguments
  if (node.typeArguments) {
    node.typeArguments.params.forEach((arg) =>
      findTypeParamUsage(arg, paramName, covariant, result),
    );
  }
  // qualName may also reference the parameter
  findTypeParamUsage(node.qualifier, paramName, covariant, result);
}

function findTypeParamUsage(
  node: TSESTree.Node | null | undefined,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  if (!node) return;

  if (node.type === "TSTypeReference") {
    handleTypeReference(node, paramName, covariant, result);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (node.type === ("TSParenthesizedType" as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handleParenthesizedType(node as any, paramName, covariant, result);
    return;
  }

  switch (node.type) {
    case "TSFunctionType":
    case "TSConstructorType":
      handleFunctionType(node, paramName, result);
      break;
    case "TSArrayType":
      handleArrayType(node, paramName, covariant, result);
      break;
    case "TSTupleType":
      handleTupleType(node, paramName, covariant, result);
      break;
    case "TSUnionType":
    case "TSIntersectionType":
      handleUnionOrIntersectionType(node, paramName, covariant, result);
      break;
    case "TSTypeLiteral":
      handleTypeLiteral(node, paramName, covariant, result);
      break;
    case "TSConditionalType":
      handleConditionalType(node, paramName, result);
      break;
    case "TSIndexedAccessType":
      handleIndexedAccessType(node, paramName, result);
      break;
    case "TSPropertySignature":
      handlePropertySignature(node, paramName, result);
      break;
    case "TSCallSignatureDeclaration":
      handleCallSignature(node, paramName, result);
      break;
    case "TSConstructSignatureDeclaration":
      handleConstructSignature(node, paramName, result);
      break;
    case "TSMethodSignature":
      handleMethodSignature(node, paramName, result);
      break;
    case "TSTypeAnnotation":
      handleTypeAnnotation(node, paramName, covariant, result);
      break;
    case "TSTypeQuery":
      handleTypeQuery(node, paramName, result);
      break;
    case "TSTypeOperator":
      handleTypeOperator(node, paramName, covariant, result);
      break;
    case "TSMappedType":
      handleMappedType(node, paramName, result);
      break;
    case "TSImportType":
      handleImportType(node, paramName, covariant, result);
      break;
    case "TSInferType":
      // infer U inside conditionals doesn't reference the outer type parameter
      break;
  }
}

export default createRule({
  name: "require-explicit-variance",
  meta: {
    type: "suggestion",
    fixable: undefined,
    docs: {
      description:
        "Require explicit `out` or `in` variance annotations on generic type parameters used in a single variance position",
    },
    messages: {
      suggestOut:
        "Type parameter '{{name}}' is only used in covariant (output) positions. Add `out` variance annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T49-associated-types.md",
      suggestIn:
        "Type parameter '{{name}}' is only used in contravariant (input) positions. Add `in` variance annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T49-associated-types.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"suggestOut" | "suggestIn", []>) {
    function checkTypeParamUsage(
      tp: TSESTree.TSTypeParameter,
      paramName: string,
      members: TSESTree.TypeElement[],
    ): void {
      if (hasVarianceAnnotation(tp)) return;

      const usage = { covariant: false, contravariant: false };

      members.forEach((member) => {
        if (
          member.type === "TSPropertySignature" ||
          member.type === "TSMethodSignature" ||
          member.type === "TSCallSignatureDeclaration" ||
          member.type === "TSConstructSignatureDeclaration"
        ) {
          findTypeParamUsage(member, paramName, false, usage);
        }
      });

      reportVarianceIssue(tp, paramName, usage);
    }

    function reportVarianceIssue(
      tp: TSESTree.TSTypeParameter,
      paramName: string,
      usage: { covariant: boolean; contravariant: boolean },
    ): void {
      if (usage.covariant && !usage.contravariant) {
        context.report({
          node: tp,
          messageId: "suggestOut",
          data: { name: paramName },
        });
      } else if (usage.contravariant && !usage.covariant) {
        context.report({
          node: tp,
          messageId: "suggestIn",
          data: { name: paramName },
        });
      }
    }

    function checkDeclaration(node: TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration): void {
      if (!node.typeParameters?.params.length) return;

      const typeParams = node.typeParameters.params;

      if (node.type === "TSInterfaceDeclaration") {
        typeParams.forEach((tp) => {
          const paramName = tp.name.type === "Identifier" ? tp.name.name : "";
          if (!paramName) return;
          checkTypeParamUsage(tp, paramName, node.body.body);
        });
      } else {
        const typeAnn = node.typeAnnotation;
        if (typeAnn?.type === "TSTypeLiteral") {
          typeParams.forEach((tp) => {
            const paramName = tp.name.type === "Identifier" ? tp.name.name : "";
            if (!paramName) return;
            checkTypeParamUsage(tp, paramName, typeAnn.members);
          });
        } else if (typeAnn) {
          typeParams.forEach((tp) => {
            if (hasVarianceAnnotation(tp)) return;

            const paramName = tp.name.type === "Identifier" ? tp.name.name : "";
            if (!paramName) return;

            const usage = { covariant: false, contravariant: false };
            findTypeParamUsage(typeAnn, paramName, true, usage);
            reportVarianceIssue(tp, paramName, usage);
          });
        }
      }
    }

    return {
      TSInterfaceDeclaration: checkDeclaration,
      TSTypeAliasDeclaration: checkDeclaration,
    };
  },
});
