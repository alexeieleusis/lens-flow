import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC07-callable-contracts.md");

function getPropertyName(key: TSESTree.PropertyName): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

type CallableBody = TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral;

function checkCallableBody(
  context: TSESLint.RuleContext<"leakedInternals", []>,
  node: CallableBody,
) {
  const members = node.type === "TSInterfaceBody" ? node.body : node.members;
  const hasCallSignature = members.some(
    (member) => member.type === "TSCallSignatureDeclaration",
  );

  if (!hasCallSignature) return;

  const underscoreProps = members
    .filter(
      (member): member is TSESTree.TSPropertySignature =>
        member.type === "TSPropertySignature",
    )
    .filter((member) => {
      const name = getPropertyName(member.key);
      return name?.startsWith("_");
    });

  if (underscoreProps.length > 0) {
    context.report({
      node,
      messageId: "leakedInternals",
      data: {
        internals: underscoreProps
          .map((m) => getPropertyName(m.key))
          .join(", "),
        url: URL,
      },
    });
  }
}

export default createRule({
  name: "no-call-signature-leaked-internals",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow callable types with call signatures from also declaring underscore-prefixed internal properties",
    },
    messages: {
      leakedInternals:
        "Interface has a call signature but also exposes {{internals}} — internal state should be moved to a separate interface. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leakedInternals", []>) {
    return {
      TSInterfaceBody(node) {
        checkCallableBody(context, node);
      },
      TSTypeLiteral(node) {
        checkCallableBody(context, node);
      },
    };
  },
});
