import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function hasVarianceAnnotation(tp: TSESTree.TSTypeParameter): boolean {
  return !!(tp as TSESTree.TSTypeParameter & { out?: boolean; in?: boolean }).out || !!(tp as TSESTree.TSTypeParameter & { out?: boolean; in?: boolean }).in;
}

function findTypeParamUsage(
  node: TSESTree.Node | null | undefined,
  paramName: string,
  covariant: boolean,
  result: { covariant: boolean; contravariant: boolean },
): void {
  if (!node) return;

  if (node.type === "TSTypeReference") {
    const name = node.typeName.type === "Identifier"
      ? node.typeName.name
      : node.typeName.type === "TSQualifiedName" && node.typeName.right.type === "Identifier"
        ? node.typeName.right.name
        : null;
    if (name === paramName) {
      if (covariant) result.covariant = true;
      else result.contravariant = true;
      return;
    }
  }

  // TSParenthesizedType isn't in AST_NODE_TYPES enum in this version of @typescript-eslint,
  // so we handle it before the switch with a raw string check and typed cast.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (node.type === ("TSParenthesizedType" as any)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pn = node as any;
    findTypeParamUsage(pn.typeAnnotation, paramName, covariant, result);
    return;
  }

  switch (node.type) {
    case "TSFunctionType":
    case "TSConstructorType": {
      node.params.forEach((p) => {
        if ("typeAnnotation" in p && p.typeAnnotation)
          findTypeParamUsage(p.typeAnnotation, paramName, false, result);
      });
      findTypeParamUsage(node.returnType, paramName, true, result);
      break;
    }
    case "TSArrayType":
      findTypeParamUsage(node.elementType, paramName, covariant, result);
      break;
    case "TSTupleType":
      node.elementTypes.forEach((el) =>
        findTypeParamUsage(el, paramName, covariant, result),
      );
      break;
    case "TSUnionType":
    case "TSIntersectionType":
      node.types.forEach((m) =>
        findTypeParamUsage(m, paramName, covariant, result),
      );
      break;
    case "TSTypeLiteral":
      node.members.forEach((m) =>
        findTypeParamUsage(m, paramName, covariant, result),
      );
      break;
    case "TSConditionalType": {
      findTypeParamUsage(node.checkType, paramName, false, result);
      findTypeParamUsage(node.falseType, paramName, false, result);
      findTypeParamUsage(node.trueType, paramName, true, result);
      break;
    }
    case "TSIndexedAccessType": {
      findTypeParamUsage(node.objectType, paramName, false, result);
      findTypeParamUsage(node.indexType, paramName, false, result);
      break;
    }
    case "TSPropertySignature": {
      if (node.typeAnnotation) {
        findTypeParamUsage(node.typeAnnotation, paramName, true, result);
      }
      break;
    }
    case "TSCallSignatureDeclaration": {
      const csd = node as TSESTree.TSCallSignatureDeclaration;
      (csd.params || []).forEach((p) => {
        if ("typeAnnotation" in p && p.typeAnnotation)
          findTypeParamUsage(p.typeAnnotation, paramName, false, result);
      });
      if (csd.returnType) findTypeParamUsage(csd.returnType.typeAnnotation, paramName, true, result);
      break;
    }
    case "TSConstructSignatureDeclaration": {
      const csd = node as TSESTree.TSConstructSignatureDeclaration;
      (csd.params || []).forEach((p) => {
        if ("typeAnnotation" in p && p.typeAnnotation)
          findTypeParamUsage(p.typeAnnotation, paramName, false, result);
      });
      if (csd.returnType) findTypeParamUsage(csd.returnType.typeAnnotation, paramName, true, result);
      break;
    }
    case "TSMethodSignature": {
      const ms = node as TSESTree.TSMethodSignature;
      (ms.params || []).forEach((p) => {
        if ("typeAnnotation" in p && p.typeAnnotation)
          findTypeParamUsage(p.typeAnnotation, paramName, false, result);
      });
      if (ms.returnType) findTypeParamUsage(ms.returnType.typeAnnotation, paramName, true, result);
      break;
    }
    case "TSTypeAnnotation":
      findTypeParamUsage(node.typeAnnotation, paramName, covariant, result);
      break;
    case "TSTypeQuery":
      // typeof X<T> — variance depends on how the queried type uses its parameters.
      // Treating as invariant to avoid silent false negatives.
      findTypeParamUsage(node.exprName, paramName, true, result);
      findTypeParamUsage(node.exprName, paramName, false, result);
      break;
    case "TSTypeOperator": {
      if (node.operator === "keyof") {
        // keyof T — the operand is used contravariantly
        findTypeParamUsage(node.typeAnnotation, paramName, false, result);
      } else {
        // readonly preserves the original variance
        findTypeParamUsage(node.typeAnnotation, paramName, covariant, result);
      }
      break;
    }
    case "TSMappedType": {
      // typeParameter (e.g., "K in keyof T") — bound is contravariant
      if (node.typeParameter) {
        findTypeParamUsage(node.typeParameter.constraint, paramName, false, result);
      }
      // typeAnnotation uses T covariantly
      if (node.typeAnnotation) {
        findTypeParamUsage(node.typeAnnotation, paramName, true, result);
      }
      break;
    }
    case "TSImportType": {
      // import("mod").Foo<T> — check type arguments
      if (node.typeArguments) {
        node.typeArguments.params.forEach((arg) =>
          findTypeParamUsage(arg, paramName, covariant, result),
        );
      }
      // qualName may also reference the parameter
      findTypeParamUsage(node.qualifier, paramName, covariant, result);
      break;
    }
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
