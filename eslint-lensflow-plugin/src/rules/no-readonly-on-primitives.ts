import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/types";

const PRIMITIVE_TYPE_NODES = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSBooleanKeyword",
  "TSBigIntKeyword",
  "TSSymbolKeyword",
]);

function isPrimitiveLiteralType(node: TSESTree.Node): boolean {
  if (node.type !== "TSLiteralType") return false;
  const { literal } = node;
  if (literal.type !== "Literal") return false;
  const val = literal.value;
  if (typeof val === "object") return false;
  if (typeof val === "boolean") return false;
  return true;
}

function unwrapParens(node: TSESTree.TypeNode): TSESTree.TypeNode {
  while (node.type === ("TSParenthesizedType" as TSESTree.TypeNode["type"])) {
    node = (node as unknown as { typeAnnotation: TSESTree.TypeNode }).typeAnnotation;
  }
  return node;
}

function getTypeName(unwrapped: TSESTree.TypeNode): string {
  let typeName: string = unwrapped.type;
  if (unwrapped.type === "TSLiteralType") {
    const lit = unwrapped as unknown as { literal: { value?: unknown } };
    const v = lit.literal.value;
    if (typeof v === "number") typeName = "number";
    else if (typeof v === "boolean") typeName = "boolean";
    else typeName = "string";
  }
  return typeName;
}

function createReadonlyFix(
  context: TSESLint.RuleContext<"redundantReadonly", []>,
  targetNode: TSESTree.Node,
): (fixer: TSESLint.RuleFixer) => TSESLint.RuleFix | TSESLint.RuleFix[] | null {
  return (fixer) => {
    const source = context.sourceCode;
    const readonlyToken = source.getTokenBefore(
      targetNode,
      (token) => token.value === "readonly",
    );
    if (!readonlyToken) return null;
    const nextToken = source.getTokenAfter(readonlyToken);
    if (!nextToken) return null;
    return fixer.removeRange([
      readonlyToken.range[0],
      nextToken.range[0],
    ]);
  };
}

export default createRule({
  name: "no-readonly-on-primitives",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow `readonly` on properties typed as primitive types, since primitives are already immutable by value.",
    },
    messages: {
      redundantReadonly:
        "`readonly` on `{{name}}` is redundant because `{{type}}` is a primitive and already immutable by value. Remove the `readonly` modifier. See: https://github.com/jpablo/vibe-types/blob/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantReadonly", []>) {
    function checkFieldNode(
      node: TSESTree.TSPropertySignature | TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition,
    ) {
      if (!node.readonly) return;

      const typeAnn = node.typeAnnotation?.typeAnnotation;
      if (!typeAnn) return;

      const unwrapped = unwrapParens(typeAnn);

      if (unwrapped.type === "TSTypeReference") return;

      if (
        !PRIMITIVE_TYPE_NODES.has(unwrapped.type) &&
        !isPrimitiveLiteralType(unwrapped)
      )
        return;

      let propName: string;
      if (node.key.type === "Identifier") {
        propName = node.key.name;
      } else if (node.key.type === "Literal") {
        propName = String((node.key as { value: unknown }).value);
      } else {
        propName = "this property";
      }

      context.report({
        node,
        messageId: "redundantReadonly",
        data: { name: propName, type: getTypeName(unwrapped) },
        fix: createReadonlyFix(context, node.key),
      });
    }

    function checkParameterProperty(node: TSESTree.TSParameterProperty) {
      if (!node.readonly) return;

      const param = node.parameter;
      const typeAnn = param.typeAnnotation?.typeAnnotation;
      if (!typeAnn) return;

      const unwrapped = unwrapParens(typeAnn);

      if (unwrapped.type === "TSTypeReference") return;

      if (
        !PRIMITIVE_TYPE_NODES.has(unwrapped.type) &&
        !isPrimitiveLiteralType(unwrapped)
      )
        return;

      const propName = param.type === "Identifier" ? param.name : "this parameter";

      context.report({
        node,
        messageId: "redundantReadonly",
        data: { name: propName, type: getTypeName(unwrapped) },
        fix: createReadonlyFix(context, param),
      });
    }

    return {
      TSPropertySignature(node) {
        checkFieldNode(node);
      },
      PropertyDefinition(node) {
        checkFieldNode(node);
      },
      TSAbstractPropertyDefinition(node) {
        checkFieldNode(node);
      },
      TSParameterProperty(node) {
        checkParameterProperty(node);
      },
    };
  },
});
