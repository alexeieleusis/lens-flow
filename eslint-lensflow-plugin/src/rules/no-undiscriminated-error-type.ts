import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC08-error-handling.md");
const DISCRIMINANT_PATTERN = /^(kind|tag|code|type)$/;
const ERROR_NAME_PATTERN = /Error|Fail|Exception/;

function isStringType(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSStringKeyword;
}

function isLiteralType(node: TSESTree.TypeNode): boolean {
  return node.type === AST_NODE_TYPES.TSLiteralType;
}

function getKeyName(key: TSESTree.PropertyName): string | undefined {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof key.value === "string")
    return key.value;
  return undefined;
}

function hasDiscriminant(members: TSESTree.TSPropertySignature[]): boolean {
  return members.some((member) => {
    if (!member.typeAnnotation) return false;
    const name = getKeyName(member.key);
    if (name == null || !DISCRIMINANT_PATTERN.test(name)) return false;
    return isLiteralType(member.typeAnnotation.typeAnnotation);
  });
}

function isStringProperty(member: TSESTree.TSPropertySignature): boolean {
  return (
    member.typeAnnotation != null &&
    isStringType(member.typeAnnotation.typeAnnotation)
  );
}

function getParentDeclarationName(
  node: TSESTree.TSTypeLiteral | TSESTree.TSInterfaceBody,
  sourceCode: TSESLint.SourceCode,
): string | null {
  const ancestors = sourceCode.getAncestors(node);
  for (const ancestor of ancestors) {
    if (ancestor.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
      return ancestor.id.name;
    }
    if (ancestor.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
      return ancestor.id.name;
    }
  }
  return null;
}

export default createRule({
  name: "no-undiscriminated-error-type",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow error types with only a generic message string and no discriminant property",
    },
    messages: {
      undiscriminatedError:
        "Error type '{{name}}' has no discriminant property. Add a 'kind', 'tag', 'code', or 'type' property with a literal type to enable exhaustive pattern matching. See: {{url}}",
      singleMessageProperty:
        "Type '{{name}}' has only a 'message: string' property, making it an undiscriminated error type. Consider using a discriminated union for different error kinds. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "singleMessageProperty" | "undiscriminatedError",
      []
    >,
  ) {
    function checkTypeBody(
      node: TSESTree.TSTypeLiteral | TSESTree.TSInterfaceBody,
    ) {
      // TSInterfaceBody uses `body`, TSTypeLiteral uses `members`
      const rawMembers = "members" in node ? node.members : node.body;
      if (!rawMembers || rawMembers.length === 0) return;

      const members = rawMembers.filter(
        (m) => m.type === AST_NODE_TYPES.TSPropertySignature,
      );

      if (members.length === 0) return;

      const declName = getParentDeclarationName(node, context.sourceCode);
      const hasDisc = hasDiscriminant(members);

      // Case 1: exactly one property named 'message' with type string
      if (
        members.length === 1 &&
        isStringProperty(members[0]) &&
        getKeyName(members[0].key) === "message"
      ) {
        context.report({
          node,
          messageId: "singleMessageProperty",
          data: { name: declName ?? "unnamed", url: URL },
        });
        return;
      }

      // Case 2: single property named 'message' or 'error' with string type,
      // and parent declaration name matches error pattern
      if (
        members.length === 1 &&
        isStringProperty(members[0]) &&
        (["message", "error"] as string[]).includes(
          getKeyName(members[0].key) ?? "",
        ) &&
        declName != null &&
        ERROR_NAME_PATTERN.test(declName)
      ) {
        context.report({
          node,
          messageId: "undiscriminatedError",
          data: { name: declName, url: URL },
        });
        return;
      }

      // Case 3: fewer than 2 properties, no discriminant,
      // parent name matches error pattern
      if (
        members.length < 2 &&
        !hasDisc &&
        declName != null &&
        ERROR_NAME_PATTERN.test(declName)
      ) {
        context.report({
          node,
          messageId: "undiscriminatedError",
          data: { name: declName, url: URL },
        });
      }
    }

    return {
      TSInterfaceBody(node) {
        checkTypeBody(node);
      },
      TSTypeLiteral(node) {
        checkTypeBody(node);
      },
    };
  },
});
