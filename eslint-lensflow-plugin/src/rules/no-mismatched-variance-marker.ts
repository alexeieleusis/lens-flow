import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  createVarianceDeclarationVisitor,
  isUsedAsInputInBodyFunctionPropertyOnly,
  isUsedAsOutputInBodyFunctionPropertyOnly,
} from "../utils/variance-checker.js";

const URL = knowledgeUrl(
  "catalog/T08-variance-subtyping.md",
  "Wrong marker for actual usage",
);

export default createRule({
  name: "no-mismatched-variance-marker",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type parameters annotated with `out` that are used in input positions of function-property signatures, or `in` used in output positions. Only property syntax (e.g. `set: (v: T) => void`) is checked; method syntax (e.g. `set(v: T): void`) is silently accepted by TypeScript because methods are bivariant.",
    },
    messages: {
      outInInputPosition:
        "Type parameter '{{paramName}}' is marked 'out' (covariant) but is used in an input/parameter position of a function-property signature. Add 'in' or split into separate read/write interfaces. See: {{url}}",
      inInOutputPosition:
        "Type parameter '{{paramName}}' is marked 'in' (contravariant) but is used in a return/output position of a function-property signature. Add 'out' or split into separate read/write interfaces. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "outInInputPosition" | "inInOutputPosition",
      []
    >,
  ) {
    function checkDeclaration(
      typeParams: TSESTree.TSTypeParameter[],
      body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ): void {
      for (const tp of typeParams) {
        const name = tp.name.name;

        if (tp.out && !tp.in) {
          if (isUsedAsInputInBodyFunctionPropertyOnly(body, name)) {
            context.report({
              node: tp,
              messageId: "outInInputPosition",
              data: { paramName: name, url: URL },
            });
          }
        }

        if (tp.in && !tp.out) {
          if (isUsedAsOutputInBodyFunctionPropertyOnly(body, name)) {
            context.report({
              node: tp,
              messageId: "inInOutputPosition",
              data: { paramName: name, url: URL },
            });
          }
        }
      }
    }

    return createVarianceDeclarationVisitor(checkDeclaration);
  },
});
