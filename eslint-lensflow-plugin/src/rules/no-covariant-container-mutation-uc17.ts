import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  containsTypeRef,
  paramTypeAnnotation,
} from "../utils/variance-checker.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC17-variance.md";

function paramsReferenceCovariant(
  params: TSESTree.Parameter[],
  covariantNames: Set<string>,
): boolean {
  for (const p of params) {
    const ann = paramTypeAnnotation(p);
    if (ann) {
      for (const name of covariantNames) {
        if (containsTypeRef(ann, name)) return true;
      }
    }
  }
  return false;
}

function findMatchedCovariantParam(
  params: TSESTree.Parameter[],
  covariantNames: Set<string>,
): string {
  for (const p of params) {
    const ann = paramTypeAnnotation(p);
    if (ann) {
      for (const name of covariantNames) {
        if (containsTypeRef(ann, name)) return name;
      }
    }
  }
  return "?";
}

function extractKeyName(key: TSESTree.Node): string {
  if (key.type === AST_NODE_TYPES.Identifier) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    return String((key as TSESTree.Literal).value);
  }
  return "?";
}

function checkMethodSignature(
  member: TSESTree.TSMethodSignature,
  covariantNames: Set<string>,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
) {
  if (!paramsReferenceCovariant(member.params, covariantNames)) return;

  context.report({
    node: member,
    messageId: "mutationOnCovariant",
    data: {
      methodName: extractKeyName(member.key),
      paramName: findMatchedCovariantParam(member.params, covariantNames),
      url: KNOWLEDGE_URL,
    },
  });
}

function checkPropertySignature(
  member: TSESTree.TSPropertySignature,
  covariantNames: Set<string>,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
) {
  const typeAnn = member.typeAnnotation?.typeAnnotation;
  if (typeAnn?.type !== AST_NODE_TYPES.TSFunctionType) return;
  if (!paramsReferenceCovariant(typeAnn.params, covariantNames)) return;

  context.report({
    node: member,
    messageId: "propertyMutationOnCovariant",
    data: {
      propName: extractKeyName(member.key),
      paramName: findMatchedCovariantParam(typeAnn.params, covariantNames),
      url: KNOWLEDGE_URL,
    },
  });
}

export default createRule({
  name: "no-covariant-container-mutation-uc17",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutation methods or setters that accept a covariant (`out`) type parameter as input on a generic interface",
    },
    messages: {
      mutationOnCovariant:
        "Method '{{methodName}}' accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
      propertyMutationOnCovariant:
        "Property '{{propName}}' is a function type that accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutationOnCovariant" | "propertyMutationOnCovariant", []>) {
    return {
      TSInterfaceDeclaration(node) {
        const decl = node;
        if (!decl.typeParameters || !decl.body) return;

        const covariantParams = decl.typeParameters.params.filter(
          (tp) => tp.out && !tp.in,
        );
        if (covariantParams.length === 0) return;

        const covariantNames = new Set(
          covariantParams.map((tp) => tp.name.name),
        );

        for (const member of decl.body.body) {
          if (member.type === AST_NODE_TYPES.TSMethodSignature) {
            checkMethodSignature(
              member as TSESTree.TSMethodSignature,
              covariantNames,
              context,
            );
          } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
            checkPropertySignature(
              member as TSESTree.TSPropertySignature,
              covariantNames,
              context,
            );
          }
        }
      },
    };
  },
});
