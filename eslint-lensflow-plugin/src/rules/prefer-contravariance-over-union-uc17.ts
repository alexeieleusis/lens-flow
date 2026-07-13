import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { createFunctionParamVisitor } from "../utils/visitor-helpers.js";

export default createRule({
  name: "prefer-contravariance-over-union-uc17",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer contravariant generics over union types in handler interface parameters",
    },
    messages: {
      preferContravariance:
        "Handler parameter uses a union type ({{types}}) instead of a contravariant generic `<in T>`. Refactor the interface to accept a generic type parameter for polymorphic assignment. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC17-variance.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minUnionMembers: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minUnionMembers: 3 }],
  create(context: TSESLint.RuleContext<"preferContravariance", [{ minUnionMembers?: number }]>) {
    const [{ minUnionMembers } = { minUnionMembers: 3 }] = context.options ?? [
      { minUnionMembers: 3 },
    ];

    function checkParameter(param: TSESTree.Parameter) {
      // Unwrap TSParameterProperty (e.g., `public foo: T`)
      let inner: TSESTree.Parameter | TSESTree.DestructuringPattern =
        param.type === "TSParameterProperty" ? param.parameter : param;

      // Unwrap AssignmentPattern (e.g., `x: T = defaultValue`)
      if (inner.type === "AssignmentPattern") {
        inner = inner.left;
      }

      // Unwrap RestElement (e.g., `...args: T[]`)
      if (inner.type === "RestElement") {
        inner = inner.argument;
      }

      if (inner.type !== "Identifier") return;
      const typeAnn = inner.typeAnnotation?.typeAnnotation;
      if (
        typeAnn?.type !== "TSUnionType" ||
        minUnionMembers === undefined ||
        typeAnn.types.length < minUnionMembers
      ) {
        return;
      }

      const sourceCode = context.sourceCode;

      function getTypeName(t: TSESTree.TypeNode): string {
        if (t.type === "TSTypeReference") {
          if (t.typeName.type === "Identifier") return t.typeName.name;
          if (t.typeName.type === "TSQualifiedName") {
            const parts: string[] = [];
            let cur: TSESTree.EntityName = t.typeName;
            while (cur.type === "TSQualifiedName") {
              parts.unshift(cur.right.name);
              cur = cur.left;
            }
            if (cur.type === "Identifier") parts.unshift(cur.name);
            return parts.join(".");
          }
        }
        return sourceCode.getText(t);
      }

      const typeNames = typeAnn.types.map(getTypeName).join(" | ");

      context.report({
        node: typeAnn,
        messageId: "preferContravariance",
        data: { types: typeNames },
      });
    }

    return createFunctionParamVisitor(checkParameter);
  },
});
