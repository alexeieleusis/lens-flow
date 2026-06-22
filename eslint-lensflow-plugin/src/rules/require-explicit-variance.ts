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

  if (node.type === "TSTypeReference" && node.typeName.type === "Identifier") {
    const ref = node;
    if (ref.typeName.type === "Identifier" && ref.typeName.name === paramName) {
      if (covariant) result.covariant = true;
      else result.contravariant = true;
      return;
    }
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
    case "TSPropertySignature":
      // Plain property types are invariant (readable and writable) — skip
      break;
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
      findTypeParamUsage(node.exprName, paramName, false, result);
      break;
  }
}

export default createRule({
  name: "require-explicit-variance",
  meta: {
    type: "suggestion",
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
        if (member.type === "TSPropertySignature" || member.type === "TSMethodSignature") {
          findTypeParamUsage(member, paramName, true, usage);
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
