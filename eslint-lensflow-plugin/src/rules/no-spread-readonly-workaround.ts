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

function isReadonlyTypeAnnotation(node: TSESTree.TypeNode): boolean {
  // readonly T[] → TSTypeOperator { operator: "readonly" }
  if (node.type === "TSTypeOperator" && node.operator === "readonly")
    return true;

  // ReadonlyArray<T>
  if (
    node.type === "TSTypeReference" &&
    node.typeName.type === "Identifier" &&
    node.typeName.name === "ReadonlyArray"
  )
    return true;

  return false;
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
      const param = def.node as unknown as TSESTree.Parameter;
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
              const scope = context.sourceCode.getScope(spreadId);
              const variable = scope.set.get(spreadId.name);

              if (!variable) continue;

              const isReadonly = variable.defs.some((def) => {
                const typeAnn = getTypeAnnotationFromDef(def);
                return typeAnn != null && isReadonlyTypeAnnotation(typeAnn);
              });

              if (isReadonly) {
                context.report({
                  node: arg,
                  messageId: "spreadReadonlyArray",
                  data: { name: spreadId.name },
                });
              }
            } else if (inner.type === "MemberExpression") {
              const memberName =
                inner.property.type === "Identifier"
                  ? inner.property.name
                  : inner.property.type === "Literal"
                    ? String(inner.property.value)
                    : null;

              if (!memberName) continue;

              const objectExpr = inner.object;
              const unwrappedObject = unwrapTSExpressions(objectExpr);

              if (unwrappedObject.type !== "Identifier") continue;

              const scope = context.sourceCode.getScope(unwrappedObject);
              const variable = scope.set.get(unwrappedObject.name);

              if (!variable) continue;

              const isReadonly = variable.defs.some((def) => {
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
                  node: arg,
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
