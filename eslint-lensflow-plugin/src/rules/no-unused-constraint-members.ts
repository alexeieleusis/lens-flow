import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function findAccessedProperties(
  body: TSESTree.Node,
  paramName: string,
): Set<string> {
  const accessed = new Set<string>();

  walk(body, (node) => {
    if (
      node.type === "MemberExpression" &&
      !node.computed &&
      node.property.type === "Identifier" &&
      node.object.type === "Identifier" &&
      node.object.name === paramName
    ) {
      accessed.add(node.property.name);
    }
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      !node.callee.computed &&
      node.callee.property.type === "Identifier" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === paramName
    ) {
      accessed.add(node.callee.property.name);
    }
  });

  return accessed;
}

function normalizeParameter(param: TSESTree.Parameter): TSESTree.Node {
  if (param.type === "AssignmentPattern") return param.left;
  if (param.type === "TSParameterProperty") return param.parameter;
  if (param.type === "RestElement") {
    const arg = param.argument;
    if (arg.type === "ObjectPattern" || arg.type === "ArrayPattern") return arg;
    return arg;
  }
  return param;
}

function isParameterTypedWith(
  param: TSESTree.Parameter,
  typeParamName: string,
): boolean {
  const normalized = normalizeParameter(param);
  const hasTypeAnnotation =
    typeof normalized === "object" &&
    normalized !== null &&
    "typeAnnotation" in normalized &&
    (normalized as unknown as Record<string, unknown>).typeAnnotation != null;

  if (!hasTypeAnnotation) return false;

  const typeAnn = (normalized as unknown as { typeAnnotation: { typeAnnotation: TSESTree.TypeNode } }).typeAnnotation;

  function getRightmostIdentifier(entity: TSESTree.EntityName): string | null {
    if (entity.type === "Identifier") return entity.name;
    if (entity.type === "TSQualifiedName") return getRightmostIdentifier(entity.right);
    return null;
  }

  function matches(node: TSESTree.TypeNode): boolean {
    if (node.type === "TSTypeReference") {
      return getRightmostIdentifier(node.typeName) === typeParamName;
    }
    if (node.type === "TSUnionType") {
      return node.types.some(matches);
    }
    if (node.type === "TSIntersectionType") {
      return node.types.some(matches);
    }
    return false;
  }

  return matches(typeAnn.typeAnnotation);
}

function getMemberName(member: { key: TSESTree.Expression }): string {
  if (member.key.type === "Identifier") return member.key.name;
  if (member.key.type === "Literal") return String(member.key.value);
  return "";
}

function getConstraintMemberNames(
  constraint: TSESTree.TSTypeLiteral,
): string[] {
  return constraint.members
    .filter(
      (m): m is TSESTree.TSPropertySignature | TSESTree.TSMethodSignature =>
        m.type === "TSPropertySignature" || m.type === "TSMethodSignature",
    )
    .map((m) => getMemberName(m))
    .filter(Boolean);
}

function getParameterName(param: TSESTree.Parameter): string {
  const normalized = normalizeParameter(param);
  if (normalized.type === "Identifier") return normalized.name;
  return "";
}

function collectAccessedMembers(
  funcNode: FunctionNode,
  typedParams: TSESTree.Parameter[],
): Set<string> {
  const accessedMembers = new Set<string>();
  for (const param of typedParams) {
    const paramName = getParameterName(param);
    if (!paramName) continue;
    const accessed = findAccessedProperties(
      funcNode.body as TSESTree.Node,
      paramName,
    );
    for (const member of accessed) {
      accessedMembers.add(member);
    }
  }
  return accessedMembers;
}

export default createRule({
  name: "no-unused-constraint-members",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic type parameters with constraint members that are never accessed in the function body",
    },
    messages: {
     unusedConstraintMembers:
         "Generic type parameter '{{typeParam}}' has unused constraint members: {{members}}. The constraint is not enforced by any access in the function body. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minUnusedMembers: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minUnusedMembers: 1 }],
  create(context: TSESLint.RuleContext<"unusedConstraintMembers", [{ minUnusedMembers: number }]>) {
    const [{ minUnusedMembers } = { minUnusedMembers: 1 }] =
      context.options ?? [{ minUnusedMembers: 1 }];

    function reportIfAllUnused(
      typeParam: TSESTree.TSTypeParameter,
      memberNames: string[],
      accessedMembers: Set<string>,
    ) {
      const unusedMembers = memberNames.filter(
        (m) => !accessedMembers.has(m),
      );
      if (
        unusedMembers.length === memberNames.length &&
        unusedMembers.length >= minUnusedMembers
      ) {
        context.report({
          node: typeParam,
          messageId: "unusedConstraintMembers",
          data: {
            typeParam: typeParam.name.name,
            members: unusedMembers.join(", "),
            url: URL,
          },
        });
      }
    }

    function checkTypeParam(
      typeParam: TSESTree.TSTypeParameter,
      funcNode: FunctionNode,
    ) {
      const constraint = typeParam.constraint;
      if (constraint?.type !== "TSTypeLiteral") return;

      const memberNames = getConstraintMemberNames(constraint);
      if (memberNames.length === 0) return;

      const typeParamName = typeParam.name.name;
      const typedParams = funcNode.params.filter((p) =>
        isParameterTypedWith(p, typeParamName),
      );
      if (typedParams.length === 0) return;

      const accessedMembers = collectAccessedMembers(funcNode, typedParams);
      reportIfAllUnused(typeParam, memberNames, accessedMembers);
    }

    function checkFunction(funcNode: FunctionNode) {
      const typeParams = funcNode.typeParameters?.params;
      if (!typeParams || typeParams.length === 0) return;

      for (const typeParam of typeParams) {
        checkTypeParam(typeParam, funcNode);
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
