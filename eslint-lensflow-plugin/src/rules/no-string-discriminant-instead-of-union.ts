import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC14-extensibility.md");

type MemberNode = TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral;

function checkDiscriminant(
  context: TSESLint.RuleContext<"stringDiscriminant", []>,
  node: MemberNode,
  kind: "Interface" | "Type",
) {
  const members = node.type === "TSInterfaceBody" ? node.body : node.members;

  if (members.length <= 1) return;

  const discriminantProp = members.find(
    (member) =>
      member.type === "TSPropertySignature" &&
      !member.optional &&
      member.typeAnnotation?.typeAnnotation?.type === "TSUnionType" &&
      member.typeAnnotation.typeAnnotation.types.every(
        (t) =>
          t.type === "TSLiteralType" &&
          (t.literal.type === "Literal" ||
            (t.literal.type === "TemplateLiteral" &&
              t.literal.expressions.length === 0)),
      ),
  );

  if (discriminantProp?.type !== "TSPropertySignature") return;

  let propName: string;
  if (discriminantProp.key.type === "Identifier") {
    propName = discriminantProp.key.name;
  } else {
    propName =
      discriminantProp.key.type === "Literal"
        ? String(discriminantProp.key.value)
        : "?";
  }

  const ancestors = context.sourceCode.getAncestors(node);
  const decl = ancestors.find(
    (
      a,
    ): a is TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration =>
      (a.type === "TSInterfaceDeclaration" ||
        a.type === "TSTypeAliasDeclaration") &&
      a.id?.type === "Identifier",
  );
  const name = decl ? decl.id.name : "?";

  context.report({
    node,
    messageId: "stringDiscriminant",
    data: {
      kind,
      name,
      discriminant: propName,
      url: URL,
    },
  });
}

export default createRule({
  name: "no-string-discriminant-instead-of-union",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow interfaces or type literals with a string-literal-union discriminant and other fields — use a discriminated union type instead for exhaustiveness checking.",
    },
    messages: {
      stringDiscriminant:
        "{{kind}} '{{name}}' uses a string-literal-union discriminant ('{{discriminant}}') with other fields. Use a discriminated union type instead to get compile-time exhaustiveness checking. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"stringDiscriminant", []>) {
    return {
      TSInterfaceBody(node) {
        checkDiscriminant(context, node, "Interface");
      },
      TSTypeLiteral(node) {
        checkDiscriminant(context, node, "Type");
      },
    };
  },
});
