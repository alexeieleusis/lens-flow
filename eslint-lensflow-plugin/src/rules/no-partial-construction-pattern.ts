import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC10-encapsulation.md");

export default createRule({
  name: "no-partial-construction-pattern",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow classes with empty-defaulted public fields and Partial-accepting setter methods that allow partially constructed invalid states",
    },
    messages: {
      partialConstructionPattern:
        "Class {{className}} has {{propCount}} field(s) with empty/null defaults and accepts Partial data, allowing partially constructed invalid state. Use a private constructor with a validated factory method instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"partialConstructionPattern", []>) {
    return {
      ClassBody(node) {
        const emptyDefaultProps = node.body.filter(
          (member) =>
            member.type === "PropertyDefinition" &&
            member.accessibility !== "private" &&
            member.accessibility !== "protected" &&
            member.value !== null &&
            member.value !== undefined &&
            (is_empty_string_literal(member.value) ||
              is_empty_array_literal(member.value) ||
              is_null_literal(member.value)),
        );

        const partial_methods = node.body.filter(
          (member) =>
            member.type === "MethodDefinition" &&
            member.kind === "method" &&
            has_partial_param(member.value),
        );

        if (emptyDefaultProps.length >= 2 && partial_methods.length >= 1) {
          const ancestors = context.sourceCode.getAncestors(node);
          const classNode = ancestors.find(
            (a) =>
              a.type === "ClassDeclaration" || a.type === "ClassExpression",
          );
          const className =
            (classNode && "id" in classNode && classNode.id?.name) ??
            "Anonymous";

          context.report({
            node,
            messageId: "partialConstructionPattern",
            data: {
              className,
              propCount: String(emptyDefaultProps.length),
              url: URL,
            },
          });
        }
      },
    };
  },
});

function is_empty_string_literal(value: TSESTree.Expression): boolean {
  return value.type === "Literal" && value.value === "";
}

function is_empty_array_literal(value: TSESTree.Expression): boolean {
  return value.type === "ArrayExpression" && value.elements.length === 0;
}

function is_null_literal(value: TSESTree.Expression): boolean {
  return value.type === "Literal" && value.value === null;
}

function has_partial_param(
  method:
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
    | TSESTree.TSEmptyBodyFunctionExpression,
): boolean {
  return method.params.some((param) => {
    if (param.type === "TSParameterProperty") return false;
    const ta = param.typeAnnotation?.typeAnnotation;
    if (!ta) return false;

    if (ta.type === "TSTypeReference") {
      const typeName = ta.typeName;
      if (typeName.type === "Identifier" && typeName.name === "Partial") {
        return true;
      }
    }

    if (ta.type === "TSUnionType") {
      return ta.types.some((t) => t.type === "TSUndefinedKeyword");
    }

    return false;
  });
}
