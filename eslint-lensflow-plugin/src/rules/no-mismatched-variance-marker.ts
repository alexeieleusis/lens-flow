import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  createVarianceDeclarationVisitor,
  isUsedAsInputInBody,
  isUsedAsOutputInBody,
} from "../utils/variance-checker.js";
import type { TSESTree } from "@typescript-eslint/types";

export default createRule({
  name: "no-mismatched-variance-marker",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type parameters annotated with `out` that are used in input positions, or `in` used in output positions",
    },
    messages: {
      outInInputPosition:
        "Type parameter '{{paramName}}' is marked 'out' (covariant) but is used in an input/parameter position. Add 'in' or split into separate read/write interfaces.",
      inInOutputPosition:
        "Type parameter '{{paramName}}' is marked 'in' (contravariant) but is used in a return/output position. Add 'out' or split into separate read/write interfaces.",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"outInInputPosition" | "inInOutputPosition", []>) {
    function checkDeclaration(
      typeParams: TSESTree.TSTypeParameter[],
      body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ): void {
      for (const tp of typeParams) {
        const name = tp.name.name;

        if (tp.out && !tp.in) {
          if (isUsedAsInputInBody(body, name)) {
            context.report({
              node: tp,
              messageId: "outInInputPosition",
              data: { paramName: name },
            });
          }
        }

        if (tp.in && !tp.out) {
          if (isUsedAsOutputInBody(body, name)) {
            context.report({
              node: tp,
              messageId: "inInOutputPosition",
              data: { paramName: name },
            });
          }
        }
      }
    }

    return createVarianceDeclarationVisitor(checkDeclaration);
  },
});
