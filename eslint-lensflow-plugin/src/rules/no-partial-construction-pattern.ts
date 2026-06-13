import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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
        "Class {{className}} has {{propCount}} field(s) with empty/null defaults and accepts Partial data, allowing partially constructed invalid state. Use a private constructor with a validated factory method instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC10-encapsulation.md",
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

        if (
          emptyDefaultProps.length >= 2 &&
          partial_methods.length >= 1
        ) {
          const parent = node.parent;
          const className =
            parent?.type === "ClassDeclaration"
              ? parent.id?.name ?? "Anonymous"
              : "Anonymous";

          context.report({
            node,
            messageId: "partialConstructionPattern",
            data: {
              className,
              propCount: String(emptyDefaultProps.length),
            },
          });
        }
      },
    };
  },
});

function is_empty_string_literal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { type: string; value?: string };
  return v.type === "Literal" && v.value === "";
}

function is_empty_array_literal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { type: string; elements?: unknown[] };
  return v.type === "ArrayExpression" && Array.isArray(v.elements) && v.elements.length === 0;
}

function is_null_literal(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as { type: string; value?: unknown };
  return v.type === "Identifier" === false && v.type === "Literal" && v.value === null;
}

function has_partial_param(method: unknown): boolean {
  if (!method || typeof method !== "object") return false;
  const m = method as {
    params?: Array<{
      typeAnnotation?: {
        typeAnnotation?: {
          type: string;
          typeName?: { type: string; name?: string };
          types?: Array<{ type: string }>;
        };
      };
    }>;
  };
  if (!Array.isArray(m.params)) return false;

  return m.params.some((param) => {
    const ta = param.typeAnnotation?.typeAnnotation;
    if (!ta) return false;

    if (ta.type === "TSTypeReference") {
      const typeName = ta.typeName;
      if (
        typeName &&
        typeof typeName === "object" &&
        "name" in typeName &&
        typeName.name === "Partial"
      ) {
        return true;
      }
    }

    if (ta.type === "TSUnionType") {
      return ta.types?.some((t) => t.type === "TSUndefinedKeyword");
    }

    return false;
  });
}
