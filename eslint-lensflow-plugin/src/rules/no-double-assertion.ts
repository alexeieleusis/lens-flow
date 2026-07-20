import type { TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T18-conversions-coercions.md");

export default createRule({
  name: "no-double-assertion",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows double assertion chains (`x as unknown as T` or `x as any as T`) that bypass all structural overlap checks.",
    },
    messages: {
      doubleAssertion:
        "Double assertion `{{fromType}} as {{toType}}` bypasses all structural checks. Use a type guard or runtime validation instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"doubleAssertion", []>) {
    return {
      TSAsExpression(node) {
        const inner = node.expression;
        if (inner.type !== "TSAsExpression") return;

        const innerTypeAnn = inner.typeAnnotation;
        let fromType: string | undefined;

        if (innerTypeAnn.type === "TSUnknownKeyword") {
          fromType = "unknown";
        } else if (innerTypeAnn.type === "TSAnyKeyword") {
          fromType = "any";
        }

        if (!fromType) return;

        const outerTypeAnn = node.typeAnnotation;
        let toType: string;
        if (
          outerTypeAnn.type === "TSTypeReference" &&
          outerTypeAnn.typeName.type === "Identifier"
        ) {
          toType = outerTypeAnn.typeName.name;
        } else {
          const kw = {
            TSStringKeyword: "string",
            TSNumberKeyword: "number",
            TSBooleanKeyword: "boolean",
            TSBigIntKeyword: "bigint",
            TSSymbolKeyword: "symbol",
            TSUndefinedKeyword: "undefined",
            TSNullKeyword: "null",
            TSVoidKeyword: "void",
            TSNeverKeyword: "never",
            TSObjectKeyword: "object",
          };
          const label = kw[outerTypeAnn.type as keyof typeof kw];
          if (label) {
            toType = label;
          } else {
            toType = context.sourceCode.getText(outerTypeAnn);
          }
        }

        context.report({
          node,
          messageId: "doubleAssertion",
          data: { fromType, toType, url: URL },
        });
      },
    };
  },
});
