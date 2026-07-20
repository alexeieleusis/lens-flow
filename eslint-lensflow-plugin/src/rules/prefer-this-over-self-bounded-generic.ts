import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

export default createRule({
  name: "prefer-this-over-self-bounded-generic",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer polymorphic `this` return type over self-referential generic bound pattern `T extends ClassName<T>`",
    },
    messages: {
      selfBoundedGeneric:
        "Class uses self-bounded generic `T extends {{className}}<T>` which requires unsafe `as T` casts. Use polymorphic `this` return type instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"selfBoundedGeneric", []>) {
    function checkSelfBound(node: TSESTree.ClassDeclaration | TSESTree.ClassExpression) {
      const className = node.id ? node.id.name : null;

      if (!className) return;

      const typeParams = node.typeParameters;
      if (typeParams?.params.length !== 1) return;

      const param = typeParams.params[0];
      if (!param.constraint) return;

      const constraint = param.constraint;
      if (constraint.type !== "TSTypeReference") return;

      const typeName = constraint.typeName;
      if (typeName.type !== "Identifier" || typeName.name !== className) return;

      const refTypeParams = constraint.typeArguments;
      if (refTypeParams?.params.length !== 1) return;

      const innerParam = refTypeParams.params[0];
      if (innerParam.type !== "TSTypeReference") return;

      const innerTypeName = innerParam.typeName;
      if (innerTypeName.type !== "Identifier" || innerTypeName.name !== param.name.name) return;

      context.report({
        node: param,
        messageId: "selfBoundedGeneric",
        data: {
          className,
          url: URL,
        },
      });
    }

    return {
      ClassDeclaration: checkSelfBound,
      ClassExpression: checkSelfBound,
    };
  },
});
