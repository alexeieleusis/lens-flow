import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function unwrapTSExpressions(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (
    current.type === "TSNonNullExpression" ||
    current.type === "ChainExpression"
  ) {
    current = current.expression;
  }
  return current;
}

function unwrapTypeNode(node: TSESTree.TypeNode): TSESTree.TypeNode[] {
  if (node.type === "TSUnionType") {
    return node.types.flatMap(unwrapTypeNode);
  }
  if (node.type === "TSIntersectionType") {
    return node.types.flatMap(unwrapTypeNode);
  }
  return [node];
}

function isReadonlyTypeAnnotation(node: TSESTree.TypeNode): boolean {
  return unwrapTypeNode(node).some((unwrapped) => {
    // readonly T[] → TSTypeOperator { operator: "readonly" }
    if (unwrapped.type === "TSTypeOperator" && unwrapped.operator === "readonly")
      return true;

    // ReadonlyArray<T>
    if (
      unwrapped.type === "TSTypeReference" &&
      unwrapped.typeName.type === "Identifier" &&
      unwrapped.typeName.name === "ReadonlyArray"
    )
      return true;

    return false;
  });
}

function findVariableInScope(
  sourceCode: TSESLint.SourceCode,
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | null {
  let scope: TSESLint.Scope.Scope | null = sourceCode.getScope(identifier);
  while (scope) {
    const v = scope.set.get(identifier.name);
    if (v) return v;
    scope = scope.upper;
  }
  return null;
}

function isReadonlyVariable(
  variable: TSESLint.Scope.Variable,
): boolean {
  return variable.defs.some((def) => {
    const typeAnn = getTypeAnnotationFromDef(def);
    return typeAnn != null && isReadonlyTypeAnnotation(typeAnn);
  });
}

function getParamName(param: TSESTree.Parameter): string | null {
  if (param.type === "Identifier") return param.name;
  if (
    param.type === "AssignmentPattern" &&
    param.left.type === "Identifier"
  )
    return param.left.name;
  return null;
}

function getTypeAnnotationFromParamNode(
  param: TSESTree.Parameter,
): TSESTree.TypeNode | null {
  if (param.type === "Identifier" && param.typeAnnotation)
    return param.typeAnnotation.typeAnnotation;
  if (
    param.type === "AssignmentPattern" &&
    param.left.type === "Identifier" &&
    param.left.typeAnnotation
  )
    return param.left.typeAnnotation.typeAnnotation;
  return null;
}

function findParamTypeAnnotation(
  fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
  def: TSESLint.Scope.Definition,
): TSESTree.TypeNode | null {
  const defName = def.name.type === "Identifier" ? def.name.name : null;
  for (const param of fn.params) {
    const paramName = getParamName(param);
    if (defName && paramName === defName) {
      return getTypeAnnotationFromParamNode(param);
    }
  }
  return null;
}

function getTypeAnnotationFromDef(
  def: TSESLint.Scope.Definition,
): TSESTree.TypeNode | null {
  switch (def.type) {
    case "Variable": {
      const id = def.node.id;
      if (id.type === "Identifier" && id.typeAnnotation) {
        return id.typeAnnotation.typeAnnotation;
      }
      return null;
    }
    case "Parameter": {
      const node = def.node;
      if (
        node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression"
      ) {
        return findParamTypeAnnotation(
          node as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
          def,
        );
      }
      const param = node as unknown as TSESTree.Parameter;
      return getTypeAnnotationFromParamNode(param);
    }
    default:
      return null;
  }
}

function getMemberName(
  property: TSESTree.Expression | TSESTree.PrivateIdentifier,
): string | null {
  if (property.type === "Identifier") return property.name;
  if (property.type === "Literal") return String(property.value);
  return null;
}

function checkReadonlyIdentifierSpread(
  context: TSESLint.RuleContext<"spreadReadonlyArray", []>,
  spreadId: TSESTree.Identifier,
  spreadElement: TSESTree.SpreadElement,
) {
  const variable = findVariableInScope(context.sourceCode, spreadId);
  if (!variable) return;
  if (isReadonlyVariable(variable)) {
    context.report({
      node: spreadElement,
      messageId: "spreadReadonlyArray",
      data: { name: spreadId.name },
    });
  }
}

function checkReadonlyMemberSpread(
  context: TSESLint.RuleContext<"spreadReadonlyArray", []>,
  memberExpr: TSESTree.MemberExpression,
  spreadElement: TSESTree.SpreadElement,
) {
  const memberName = getMemberName(memberExpr.property);
  if (!memberName) return;

  const unwrappedObject = unwrapTSExpressions(memberExpr.object);
  if (unwrappedObject.type !== "Identifier") return;

  const objectVariable = findVariableInScope(
    context.sourceCode,
    unwrappedObject,
  );
  if (!objectVariable) return;

  const isReadonly = objectVariable.defs.some((def) => {
    const typeAnn = getTypeAnnotationFromDef(def);
    if (typeAnn?.type !== "TSTypeLiteral") return false;
    return typeAnn.members.some((m) => {
      if (m.type !== "TSPropertySignature") return false;
      if (getMemberName(m.key) !== memberName) return false;
      if (!m.typeAnnotation) return false;
      return isReadonlyTypeAnnotation(m.typeAnnotation.typeAnnotation);
    });
  });

  if (isReadonly) {
    context.report({
      node: spreadElement,
      messageId: "spreadReadonlyArray",
      data: { name: `${unwrappedObject.name}.${memberName}` },
    });
  }
}

export default createRule({
  name: "no-spread-readonly-workaround",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow spreading a readonly array into a mutable array to work around variance",
    },
    messages: {
      spreadReadonlyArray:
        "Spreading readonly array `{{name}}` into a new array is unnecessary. Change the callee parameter type from `Array<T>` to `readonly T[]`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"spreadReadonlyArray", []>) {
    return {
      CallExpression(node) {
        for (const arg of node.arguments) {
          if (
            arg.type === "ArrayExpression" &&
            arg.elements.length === 1 &&
            arg.elements[0]?.type === "SpreadElement"
          ) {
            const spreadElement = arg.elements[0];
            const inner = unwrapTSExpressions(spreadElement.argument);

            if (inner.type === "Identifier") {
              checkReadonlyIdentifierSpread(context, inner, spreadElement);
            } else if (inner.type === "MemberExpression") {
              checkReadonlyMemberSpread(context, inner, spreadElement);
            }
          }
        }
      },
    };
  },
});
