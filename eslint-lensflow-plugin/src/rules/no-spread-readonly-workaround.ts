import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function unwrapTSExpressions(node: TSESTree.Expression): TSESTree.Expression {
  let current = node;
  while (
    current.type === "TSNonNullExpression" ||
    current.type === "ChainExpression"
  ) {
    current =
      current.type === "TSNonNullExpression"
        ? current.expression
        : current.expression;
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

function getTypeAnnotationFromDef(
  def: TSESLint.Scope.Definition,
): TSESTree.TypeNode | null {
  switch (def.type) {
    case "Variable": {
      const id = (def.node as TSESTree.VariableDeclarator).id;
      if (id.type === "Identifier" && id.typeAnnotation) {
        return id.typeAnnotation.typeAnnotation;
      }
      return null;
    }
    case "Parameter": {
      const node = def.node;
      // def.node may be the parameter itself or the containing function
      if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") {
        const fn = node as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
        const params = fn.params;
        const defName = def.name.type === "Identifier" ? def.name.name : null;
        for (const param of params) {
          const paramName = param.type === "Identifier" ? param.name :
            param.type === "AssignmentPattern" && param.left.type === "Identifier" ? param.left.name : null;
          if (!defName || paramName !== defName) continue;
          if (param.type === "Identifier" && param.typeAnnotation) {
              return param.typeAnnotation.typeAnnotation;
            }
            if (param.type === "AssignmentPattern" && param.left.type === "Identifier" && param.left.typeAnnotation) {
              return param.left.typeAnnotation.typeAnnotation;
            }
        }
        return null;
      }
      const param = node as unknown as TSESTree.Parameter;
      if (param.type === "Identifier" && param.typeAnnotation) {
        return param.typeAnnotation.typeAnnotation;
      }
      if (
        param.type === "AssignmentPattern" &&
        param.left.type === "Identifier" &&
        param.left.typeAnnotation
      ) {
        return param.left.typeAnnotation.typeAnnotation;
      }
      return null;
    }
    default:
      return null;
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
            const rawArg = arg.elements[0].argument;
            const inner = unwrapTSExpressions(rawArg);

            if (inner.type === "Identifier") {
              const spreadId = inner;
              let scope: TSESLint.Scope.Scope | null =
                context.sourceCode.getScope(spreadId);
              let variable: TSESLint.Scope.Variable | null = null;
              while (scope) {
                const v = scope.set.get(spreadId.name);
                if (v) {
                  variable = v;
                  break;
                }
                scope = scope.upper;
              }

              if (!variable) continue;

              const isReadonly = variable.defs.some((def) => {
                const typeAnn = getTypeAnnotationFromDef(def);
                return typeAnn != null && isReadonlyTypeAnnotation(typeAnn);
              });

              if (isReadonly) {
                context.report({
                  node: arg.elements[0],
                  messageId: "spreadReadonlyArray",
                  data: { name: spreadId.name },
                });
              }
            } else if (inner.type === "MemberExpression") {
              let memberName: string | null = null;
              if (inner.property.type === "Identifier") {
                memberName = inner.property.name;
              } else if (inner.property.type === "Literal") {
                memberName = String(inner.property.value);
              }

              if (!memberName) continue;

              const objectExpr = inner.object;
              const unwrappedObject = unwrapTSExpressions(objectExpr);

              if (unwrappedObject.type !== "Identifier") continue;

              let objectScope: TSESLint.Scope.Scope | null =
                context.sourceCode.getScope(unwrappedObject);
              let objectVariable: TSESLint.Scope.Variable | null = null;
              while (objectScope) {
                const v = objectScope.set.get(unwrappedObject.name);
                if (v) {
                  objectVariable = v;
                  break;
                }
                objectScope = objectScope.upper;
              }

              if (!objectVariable) continue;

              const isReadonly = objectVariable.defs.some((def) => {
                const typeAnn = getTypeAnnotationFromDef(def);
                if (typeAnn?.type !== "TSTypeLiteral") return false;

                const member = typeAnn.members.find((m) => {
                  if (m.type !== "TSPropertySignature") return false;
                  const key = m.key;

                  let keyName: string | null = null;
                  if (key.type === "Identifier") {
                    keyName = key.name;
                  } else if (key.type === "Literal") {
                    keyName = String(key.value);
                  }

                  if (keyName !== memberName) return false;

                  if (!m.typeAnnotation) return false;
                  return isReadonlyTypeAnnotation(m.typeAnnotation.typeAnnotation);
                });

                return !!member;
              });

              if (isReadonly) {
                context.report({
                  node: arg.elements[0],
                  messageId: "spreadReadonlyArray",
                  data: { name: `${unwrappedObject.name}.${memberName}` },
                });
              }
            }
          }
        }
      },
    };
  },
});
