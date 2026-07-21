import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export function createBivariantMethodVisitor(
  context: TSESLint.RuleContext<string, unknown[]>,
  options: { url?: string } = {},
): {
  TSInterfaceBody: (node: TSESTree.TSInterfaceBody) => void;
  TSTypeLiteral: (node: TSESTree.TSTypeLiteral) => void;
} {
  const reportMethod = (member: TSESTree.TSMethodSignature) => {
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
      data: { name, params, url: options.url },
    });
  };

  return {
    TSInterfaceBody(node) {
      for (const member of node.body) {
        if (member.type === "TSMethodSignature" && member.kind === "method") {
          reportMethod(member);
        }
      }
    },

    TSTypeLiteral(node) {
      for (const member of node.members) {
        if (member.type === "TSMethodSignature" && member.kind === "method") {
          reportMethod(member);
        }
      }
    },
  };
}
