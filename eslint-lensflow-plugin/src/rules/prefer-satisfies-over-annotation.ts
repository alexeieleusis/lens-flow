import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const URL = knowledgeUrl("catalog/T52-literal-types.md");

function buildQualifiedName(node: TSESTree.TSQualifiedName): string {
  let left: string;
  if (node.left.type === "Identifier") {
    left = node.left.name;
  } else if (node.left.type === "TSQualifiedName") {
    left = buildQualifiedName(node.left);
  } else {
    left = "this";
  }
  return `${left}.${node.right.name}`;
}

const PRIMITIVE_KEYWORDS: Record<string, string> = {
  TSStringKeyword: "string",
  TSNumberKeyword: "number",
  TSBooleanKeyword: "boolean",
  TSBigIntKeyword: "bigint",
  TSSymbolKeyword: "symbol",
  TSAnyKeyword: "any",
  TSUnknownKeyword: "unknown",
  TSNeverKeyword: "never",
  TSVoidKeyword: "void",
  TSUndefinedKeyword: "undefined",
  TSNullKeyword: "null",
  TSObjectKeyword: "object",
  TSIntrinsicKeyword: "intrinsic",
};

function extractTypeName(typeNode: TSESTree.TypeNode, sourceCode: TSESLint.SourceCode): string {
  if (typeNode.type === "TSTypeReference") {
    const tn = typeNode.typeName;
    if (tn.type === "Identifier") return tn.name;
    if (tn.type === "TSQualifiedName") return buildQualifiedName(tn);
  }

  if (typeNode.type in PRIMITIVE_KEYWORDS) {
    return PRIMITIVE_KEYWORDS[typeNode.type];
  }

  if (typeNode.type === "TSLiteralType") {
    const lit = typeNode.literal;
    if (lit.type === "Literal") return String(lit.value);
  }

  if (typeNode.type === "TSTypeLiteral") {
    return "{ ... }";
  }

  if (typeNode.type === "TSArrayType") {
    return `${extractTypeName(typeNode.elementType, sourceCode)}[]`;
  }

  if (typeNode.type === "TSTupleType") {
    return `[${typeNode.elementTypes.map((e) => extractTypeName(e, sourceCode)).join(", ")}]`;
  }

  return sourceCode.getText(typeNode);
}

export default createRule({
  name: "prefer-satisfies-over-annotation",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer `satisfies T` over `: T` for const bindings initialized with object literals containing literal values",
    },
    messages: {
      preferSatisfies:
        "Use `satisfies {{type}}` instead of `: {{type}}` to preserve literal types. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferSatisfies", []>) {
    return {
      VariableDeclarator(node) {
        const parent = node.parent;
        if (
          parent?.type !== "VariableDeclaration" ||
          parent.kind !== "const"
        ) {
          return;
        }

        const init = node.init;
        if (!init) return;

        if (init.type === "TSSatisfiesExpression") return;

        if (init.type !== "ObjectExpression") return;

        const hasLiteralValues = init.properties.some(
          (prop) =>
            prop.type === "Property" &&
            !prop.method &&
            prop.value.type === "Literal",
        );
        if (!hasLiteralValues) return;

        if (!node.id.typeAnnotation) return;

        const sourceCode = context.sourceCode;
        const typeAnnotation = node.id.typeAnnotation.typeAnnotation;

        let typeName: string;
        if (typeAnnotation.type === "TSUnionType") {
          typeName = typeAnnotation.types
            .map((t) => extractTypeName(t, sourceCode))
            .join(" | ");
        } else {
          typeName = extractTypeName(typeAnnotation, sourceCode);
        }

        context.report({
          node: node.id.typeAnnotation,
          messageId: "preferSatisfies",
          data: { type: typeName, url: URL },
        });
      },
    };
  },
});
