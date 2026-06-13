import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type FunctionNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function findAccessedProperties(
  body: TSESTree.Node,
  paramName: string,
): Set<string> {
  const accessed = new Set<string>();
  const visited = new WeakSet<TSESTree.Node>();

  function isAstNode(val: unknown): val is TSESTree.Node {
    return val != null && typeof val === "object" && "type" in val;
  }

  function visitChildren(node: TSESTree.Node) {
    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const val = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (isAstNode(item)) traverse(item);
        }
      } else if (isAstNode(val)) {
        traverse(val);
      }
    }
  }

  function traverse(node: TSESTree.Node) {
    if (visited.has(node)) return;
    visited.add(node);

    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier" && node.object.type === "Identifier" && node.object.name === paramName) {
      accessed.add(node.property.name);
    }

    visitChildren(node);
  }

  traverse(body);
  return accessed;
}

function isParameterTypedWith(
  param: TSESTree.Parameter,
  typeParamName: string,
): boolean {
  if (param.type !== "Identifier" || !param.typeAnnotation) return false;
  const typeAnn = param.typeAnnotation.typeAnnotation;
  if (typeAnn.type === "TSTypeReference") {
    return (
      typeAnn.typeName.type === "Identifier" &&
      typeAnn.typeName.name === typeParamName
    );
  }
  return false;
}

function getConstraintMemberNames(
  constraint: TSESTree.TSTypeLiteral,
): string[] {
  return constraint.members
    .filter(
      (m): m is TSESTree.TSPropertySignature =>
        m.type === "TSPropertySignature",
    )
    .map((m) => {
      if (m.key.type === "Identifier") return m.key.name;
      if (m.key.type === "Literal") return String(m.key.value);
      return "";
    })
    .filter(Boolean);
}

function collectAccessedMembers(
  funcNode: FunctionNode,
  typedParams: TSESTree.Parameter[],
): Set<string> {
  const accessedMembers = new Set<string>();
  for (const param of typedParams) {
    const paramName =
      param.type === "Identifier" ? param.name : "";
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
        "Generic type parameter '{{typeParam}}' has unused constraint members: {{members}}. The constraint is not enforced by any access in the function body. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
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
