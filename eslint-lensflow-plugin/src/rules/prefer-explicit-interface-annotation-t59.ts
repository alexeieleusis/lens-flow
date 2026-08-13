import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { getObjectKeys } from "../utils/ast-helpers.js";

const URL = knowledgeUrl(
  "catalog/T59-existential-types.md",
  "5. Gotchas and Limitations",
);

export default createRule({
  name: "prefer-explicit-interface-annotation-t59",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer explicit type annotation over `satisfies` when satisfying a named type reference with an object literal that has excess properties.",
    },
    messages: {
      preferAnnotation:
        "Use an explicit type annotation instead of `satisfies` with a named type `{{typeName}}`. An explicit annotation more reliably hides excess properties from inference. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferAnnotation", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    if (!parserServices.program) return {};
    const checker = parserServices.program.getTypeChecker();

    return {
      TSSatisfiesExpression(node) {
        const typeAnnotation = node.typeAnnotation;

        if (typeAnnotation.type !== "TSTypeReference") return;
        const typeNameNode = typeAnnotation.typeName;
        if (typeNameNode.type !== "Identifier") return;

        if (node.expression.type !== "ObjectExpression") return;
        const objKeys = getObjectKeys(node.expression);
        if (objKeys.length === 0) return;

        const tsTypeNode =
          parserServices.esTreeNodeToTSNodeMap.get(typeAnnotation);
        if (!tsTypeNode) return;
        const tsType = checker.getTypeFromTypeNode(tsTypeNode);

        const hasExcessProperty = objKeys.some(
          (key) => !tsType.getProperty(key),
        );
        if (!hasExcessProperty) return;

        context.report({
          node,
          messageId: "preferAnnotation",
          data: { typeName: typeNameNode.name, url: URL },
        });
      },
    };
  },
});
