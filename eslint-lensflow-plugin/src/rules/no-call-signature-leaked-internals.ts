import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getPropertyName(key: TSESTree.PropertyName): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

export default createRule({
  name: "no-call-signature-leaked-internals",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow interfaces with call signatures from also declaring underscore-prefixed internal properties",
    },
    messages: {
      leakedInternals:
        "Interface has a call signature but also exposes {{internals}} — internal state should be moved to a separate interface. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC07-callable-contracts.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leakedInternals", []>) {
    return {
      TSInterfaceBody(node) {
        const hasCallSignature = node.body.some(
          (member) => member.type === "TSCallSignatureDeclaration",
        );

        if (!hasCallSignature) return;

        const underscoreProps = node.body
          .filter(
            (member): member is TSESTree.TSPropertySignature =>
              member.type === "TSPropertySignature",
          )
          .filter((member) => {
            const name = getPropertyName(member.key);
            return name !== null && name.startsWith("_");
          });

        if (underscoreProps.length > 0) {
          context.report({
            node,
            messageId: "leakedInternals",
            data: {
              internals: underscoreProps
                .map((m) => getPropertyName(m.key))
                .join(", "),
            },
          });
        }
      },
    };
  },
});
