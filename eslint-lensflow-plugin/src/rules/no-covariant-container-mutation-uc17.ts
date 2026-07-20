import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  containsTypeRef,
  paramTypeAnnotation,
  createVarianceDeclarationVisitor,
  paramsContainAnyTypeRef,
} from "../utils/variance-checker.js";

const URL = knowledgeUrl("usecases/UC17-variance.md");

function findMatchedCovariantParam(
  params: TSESTree.Parameter[],
  covariantNames: Set<string>,
): { name: string; node: TSESTree.Parameter } | null {
  for (const p of params) {
    const ann = paramTypeAnnotation(p);
    if (ann) {
      for (const name of covariantNames) {
        if (containsTypeRef(ann, name)) return { name, node: p };
      }
    }
  }
  return null;
}

function paramText(
  match: { name: string; node: TSESTree.Parameter },
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
): string {
  const ann = paramTypeAnnotation(match.node);
  if (ann) return context.sourceCode.getText(ann);
  return context.sourceCode.getText(match.node);
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
  if (!paramsContainAnyTypeRef(member.params, [...covariantNames])) return;

  const match = findMatchedCovariantParam(member.params, covariantNames);
  if (!match) return;

  context.report({
    node: member,
    messageId: "mutationOnCovariant",
    data: {
      methodName: extractKeyName(member.key),
      paramName: paramText(match, context),
      url: URL,
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
  if (!paramsContainAnyTypeRef(typeAnn.params, [...covariantNames])) return;

  const match = findMatchedCovariantParam(typeAnn.params, covariantNames);
  if (!match) return;

  context.report({
    node: member,
    messageId: "propertyMutationOnCovariant",
    data: {
      propName: extractKeyName(member.key),
      paramName: paramText(match, context),
      url: URL,
    },
  });
}

function checkSignatureWithParams(
  member: TSESTree.Node & { params: TSESTree.Parameter[] },
  messageId: "callSignatureOnCovariant" | "constructSignatureOnCovariant",
  covariantNames: Set<string>,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
) {
  if (!paramsContainAnyTypeRef(member.params, [...covariantNames])) return;

  const match = findMatchedCovariantParam(member.params, covariantNames);
  if (!match) return;

  context.report({
    node: member,
    messageId,
    data: {
      paramName: paramText(match, context),
      url: URL,
    },
  });
}

function checkCallSignature(
  member: TSESTree.TSCallSignatureDeclaration,
  covariantNames: Set<string>,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
) {
  checkSignatureWithParams(member, "callSignatureOnCovariant", covariantNames, context);
}

function checkConstructSignature(
  member: TSESTree.TSConstructSignatureDeclaration,
  covariantNames: Set<string>,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
) {
  checkSignatureWithParams(member, "constructSignatureOnCovariant", covariantNames, context);
}

export default createRule({
  name: "no-covariant-container-mutation-uc17",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutation methods or setters that accept a covariant (`out`) type parameter as input on a generic interface or type alias",
    },
    messages: {
      mutationOnCovariant:
        "Method '{{methodName}}' accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
      propertyMutationOnCovariant:
        "Property '{{propName}}' is a function type that accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
      callSignatureOnCovariant:
        "Call signature accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
      constructSignatureOnCovariant:
        "Construct signature accepts covariant type parameter '{{paramName}}' as input. Mutation breaks covariance — use `in out` or split into separate read/write interfaces. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutationOnCovariant" | "propertyMutationOnCovariant" | "callSignatureOnCovariant" | "constructSignatureOnCovariant", []>) {
    return createVarianceDeclarationVisitor((typeParams, body) => {
      const covariantParams = typeParams.filter(
        (tp) => tp.out && !tp.in,
      );
      if (covariantParams.length === 0) return;

      const covariantNames = new Set(
        covariantParams.map((tp) => tp.name.name),
      );

      const members =
        body.type === AST_NODE_TYPES.TSInterfaceBody ? body.body : body.members;

      for (const member of members) {
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
        } else if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
          checkCallSignature(
            member,
            covariantNames,
            context,
          );
        } else if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
          checkConstructSignature(
            member,
            covariantNames,
            context,
          );
        }
      }
    });
  },
});
