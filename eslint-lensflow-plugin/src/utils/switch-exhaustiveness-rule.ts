import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "./rule-creator.js";
import { checkSwitchExhaustiveness } from "./ts-helpers.js";

export interface SwitchExhaustivenessRuleOptions {
  name: string;
  description: string;
  messageKey: string;
  messageTemplate: string;
  url: string;
}

export function createSwitchExhaustivenessRule(
  options: SwitchExhaustivenessRuleOptions,
) {
  return createRule({
    name: options.name,
    meta: {
      type: "problem",
      docs: {
        description: options.description,
      },
      messages: {
        [options.messageKey]: options.messageTemplate,
      },
      schema: [],
      fixable: undefined,
    },
    defaultOptions: [],
    create(context: TSESLint.RuleContext<string, readonly unknown[]>) {
      const parserServices = ESLintUtils.getParserServices(context, true);
      const program = parserServices.program;
      if (!program) return {};

      const checker = program.getTypeChecker();

      return {
        SwitchStatement(node: TSESTree.SwitchStatement) {
          const tsDiscriminant = parserServices.esTreeNodeToTSNodeMap.get(
            node.discriminant,
          );
          if (!tsDiscriminant) return;

          checkSwitchExhaustiveness(
            node,
            checker,
            tsDiscriminant,
            context,
            options.messageKey,
            options.url,
          );
        },
      };
    },
  });
}
