import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";

const ruleCreator = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/alexeieleusis/lens-flow/tree/main/eslint-lensflow-plugin/docs/rules/${name}`,
);

// Explicit return type prevents TS2742 ("inferred type... cannot be named
// without a reference... likely not portable"), which otherwise surfaces
// non-deterministically depending on file-check order during declaration
// emit for every `export default createRule({...})` call site.
export function createRule<
  Options extends readonly unknown[],
  MessageIds extends string,
>(
  rule: Readonly<ESLintUtils.RuleWithMetaAndName<Options, MessageIds>>,
): TSESLint.RuleModule<MessageIds, Options> {
  return ruleCreator(rule);
}
