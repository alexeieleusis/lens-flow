import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T08-variance-subtyping.md");

function reportMethod(
  context: TSESLint.RuleContext<"methodSyntax", []>,
  member: TSESTree.TSMethodSignature,
): void {
  let name: string;
  if (member.key.type === "Identifier") {
    name = member.key.name;
  } else if (member.key.type === "Literal") {
    name = String(member.key.value);
  } else {
    name = "?";
  }

  const params = member.params
    .map((p) => {
      if (p.type === "Identifier") return p.name;
      if (p.type === "AssignmentPattern")
        return `${p.left.type === "Identifier" ? p.left.name : context.sourceCode.getText(p.left)} = ...`;
      if (p.type === "RestElement")
        return `...${p.argument.type === "Identifier" ? p.argument.name : "?"}`;
      return context.sourceCode.getText(p);
    })
    .join(", ");

  context.report({
    node: member,
    messageId: "methodSyntax",
    data: { name, params, url: URL },
  });
}

function checkMembers(
  context: TSESLint.RuleContext<"methodSyntax", []>,
  members: readonly TSESTree.TypeElement[],
): void {
  for (const member of members) {
    if (member.type === "TSMethodSignature" && member.kind === "method") {
      reportMethod(context, member);
    }
  }
}

export default createRule({
  name: "no-bivariant-method-syntax",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow method-signature syntax in interfaces and type literals, which causes bivariant (unsound) parameter checking",
    },
    messages: {
      methodSyntax:
        "Method signature '{{name}}' uses bivariant syntax. Use function-property syntax (e.g. '{{name}}: ({{params}}) => ReturnType') for contravariant parameter checking. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"methodSyntax", []>) {
    return {
      TSInterfaceBody(node) {
        checkMembers(context, node.body);
      },
      TSTypeLiteral(node) {
        checkMembers(context, node.members);
      },
    };
  },
});
