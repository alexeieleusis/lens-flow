import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  createVarianceDeclarationVisitor,
  isUsedAsInputInBody,
  isUsedAsOutputInBody,
} from "../utils/variance-checker.js";
import type { TSESTree } from "@typescript-eslint/types";

export default createRule({
  name: "require-variance-annotation-uc17",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require `in` or `out` variance annotation on generic type parameters used exclusively in input or output positions",
    },
    messages: {
      suggestIn:
        "Type parameter '{{paramName}}' is only used in input (parameter) positions. Add the `in` variance annotation to make contravariant intent explicit. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC17-variance.md",
      suggestOut:
        "Type parameter '{{paramName}}' is only used in output (return) positions. Add the `out` variance annotation to make covariant intent explicit. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC17-variance.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"suggestIn" | "suggestOut", []>) {
    function checkDeclaration(
      typeParams: TSESTree.TSTypeParameter[],
      body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ): void {
      for (const tp of typeParams) {
        if (tp.in || tp.out) continue;

        const name = tp.name.name;
        const usedInInput = isUsedAsInputInBody(body, name);
        const usedInOutput = isUsedAsOutputInBody(body, name);

        if (usedInInput && !usedInOutput) {
          context.report({
            node: tp,
            messageId: "suggestIn",
            data: { paramName: name },
          });
        } else if (!usedInInput && usedInOutput) {
          context.report({
            node: tp,
            messageId: "suggestOut",
            data: { paramName: name },
          });
        }
      }
    }

    return createVarianceDeclarationVisitor(checkDeclaration);
  },
});
