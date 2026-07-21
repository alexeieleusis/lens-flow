// eslint-plugin/src/rules/require-readonly-on-array-type.ts
import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC06-immutability.md");

export default createRule({
  name: "require-readonly-on-array-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce `readonly T[]` or `ReadonlyArray<T>` instead of mutable `T[]` / `Array<T>` on interface properties already marked `readonly`",
    },
    messages: {
      mutableArrayOnReadonlyProp:
        "Property '{{name}}' is marked `readonly` but uses mutable array type '{{type}}`. Use `readonly {{type}}` to prevent in-place mutation via push/splice. See: {{url}}",
      mutableArrayRefOnReadonlyProp:
        "Property '{{name}}' is marked `readonly` but uses mutable `Array<{{element}}>` type. Use `ReadonlyArray<{{element}}>` to prevent in-place mutation via push/splice. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "mutableArrayOnReadonlyProp" | "mutableArrayRefOnReadonlyProp",
      []
    >,
  ) {
    return {
      TSPropertySignature(node) {
        const isReadonly = node.readonly;

        if (!isReadonly) return;

        const typeAnn = node.typeAnnotation?.typeAnnotation;
        if (!typeAnn) return;

        const propName =
          node.key.type === "Identifier"
            ? node.key.name
            : context.sourceCode.getText(node.key);

        if (typeAnn.type === "TSArrayType") {
          const elemType = typeAnn.elementType;
          const elemText = context.sourceCode.getText(elemType);

          context.report({
            node,
            messageId: "mutableArrayOnReadonlyProp",
            data: {
              name: propName,
              type: `${elemText}[]`,
              url: URL,
            },
          });
        }

        if (typeAnn.type === "TSTypeReference") {
          const typeName = typeAnn.typeName;
          if (typeName.type === "Identifier" && typeName.name === "Array") {
            const elemTypes = typeAnn.typeArguments?.params ?? [];
            const elemText = elemTypes.length
              ? elemTypes
                  .map((e: TSESTree.Node) => context.sourceCode.getText(e))
                  .join(", ")
              : "unknown";

            context.report({
              node,
              messageId: "mutableArrayRefOnReadonlyProp",
              data: {
                name: propName,
                element: elemText,
                url: URL,
              },
            });
          }
        }
      },
    };
  },
});
