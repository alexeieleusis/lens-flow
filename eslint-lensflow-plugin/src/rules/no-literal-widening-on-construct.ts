import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "discriminator",
  "case",
  "variant",
  "eventType",
  "messageType",
  "actionType",
  "state",
  "role",
  "flavor",
]);

function isAsConstCast(node: TSESTree.Node): boolean {
  if (node.type !== "TSAsExpression") return false;
  const ta = node.typeAnnotation;
  if (ta.type !== "TSTypeReference") return false;
  if (ta.typeName.type !== "Identifier") return false;
  return ta.typeName.name === "const";
}

function getPropKeyName(prop: TSESTree.Property): string | null {
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value;
  }
  return null;
}

function isStringLiteralProp(prop: TSESTree.Property): boolean {
  return prop.value.type === "Literal" && typeof prop.value.value === "string";
}

export default createRule({
  name: "no-literal-widening-on-construct",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow object literals whose string literal properties widen to `string` without `as const`, `satisfies`, or explicit type annotation",
    },
    messages: {
      widen:
        "Object literal assigned to discriminated-union variable '{{varName}}' without type narrowing. The discriminant '{{discriminant}}' will widen to a broader type. Use `as const`, `satisfies`, or an explicit type annotation. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"widen", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    if (!parserServices.program) return {};

    const reportIfWidenedDiscriminant = (
      prop: TSESTree.Property,
      varName: string,
    ): boolean => {
      const propType = parserServices.getTypeAtLocation(prop);
      if ((propType.flags & ts.TypeFlags.StringLiteral) !== 0) return false;

      const propName = getPropKeyName(prop);
      if (propName === null) return false;
      if (!DISCRIMINANT_NAMES.has(propName)) return false;

      context.report({
        node: prop,
        messageId: "widen",
        data: { varName, discriminant: propName, url: URL },
      });
      return true;
    };

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (node.init?.type !== "ObjectExpression") return;
        if (node.id.type !== "Identifier") return;
        if (node.id.typeAnnotation) return;
        if (node.init.parent?.type === "TSSatisfiesExpression") return;
        if (isAsConstCast(node.init.parent)) return;

        for (const prop of node.init.properties) {
          if (prop.type !== "Property") continue;
          if (!isStringLiteralProp(prop)) continue;

          if (reportIfWidenedDiscriminant(prop, node.id.name)) return;
        }
      },
    };
  },
});
