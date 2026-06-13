import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const DISCRIMINANT_PATTERN = /^(kind|tag|code|type)$/;
const ERROR_NAME_PATTERN = /[Ee]rror|[Ff]ail|[Ee]xception/;

function isStringType(node: unknown): boolean {
  const n = node as { type?: string };
  return n.type === AST_NODE_TYPES.TSStringKeyword;
}

function isLiteralType(node: unknown): boolean {
  const n = node as { type?: string };
  return n.type === AST_NODE_TYPES.TSLiteralType;
}

function hasDiscriminant(members: unknown[]): boolean {
  return members.some((member) => {
    const m = member as {
      type?: string;
      key?: { name?: string };
      typeAnnotation?: { typeAnnotation?: unknown };
    };
    if (m.type !== AST_NODE_TYPES.TSPropertySignature) return false;
    const name = m.key?.name;
    if (name == null || !DISCRIMINANT_PATTERN.test(name)) return false;
    return isLiteralType(m.typeAnnotation?.typeAnnotation);
  });
}

function isStringProperty(member: unknown): boolean {
  const m = member as {
    type?: string;
    key?: { name?: string };
    typeAnnotation?: { typeAnnotation?: unknown };
  };
  return (
    m.type === AST_NODE_TYPES.TSPropertySignature &&
    m.key?.name != null &&
    isStringType(m.typeAnnotation?.typeAnnotation)
  );
}

function getParentDeclarationName(
  node: { parent?: unknown },
): string | null {
  const parent = node.parent;
  if (!parent) return null;

  const p = parent as {
    type?: string;
    id?: { name?: string };
  };

  // Direct parent is TSTypeLiteral, go to grandparent for TSTypeAliasDeclaration
  if (p.type === AST_NODE_TYPES.TSTypeLiteral) {
    const grandparent = (p as { parent?: unknown }).parent;
    if (grandparent) {
      const gp = grandparent as {
        type?: string;
        id?: { name?: string };
      };
      if (
        gp.type === AST_NODE_TYPES.TSTypeAliasDeclaration &&
        gp.id?.name
      ) {
        return gp.id.name;
      }
    }
    return null;
  }

  if (p.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
    return p.id?.name ?? null;
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
        "Error type '{{name}}' has no discriminant property. Add a 'kind', 'tag', 'code', or 'type' property with a literal type to enable exhaustive pattern matching. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
      singleMessageProperty:
        "Type '{{name}}' has only a 'message: string' property, making it an undiscriminated error type. Consider using a discriminated union for different error kinds. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"singleMessageProperty" | "undiscriminatedError", []>) {
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

      const declName = getParentDeclarationName(node);
      const hasDisc = hasDiscriminant(members);

      // Case 1: exactly one property named 'message' with type string
      if (
        members.length === 1 &&
        isStringProperty(members[0]) &&
        (members[0].key as TSESTree.Identifier).name === "message"
      ) {
        context.report({
          node,
          messageId: "singleMessageProperty",
          data: { name: declName ?? "unnamed" },
        });
        return;
      }

      // Case 2: single property named 'message' or 'error' with string type,
      // and parent declaration name matches error pattern
      if (
        members.length === 1 &&
        isStringProperty(members[0]) &&
        (["message", "error"] as string[]).includes(
          (members[0].key as TSESTree.Identifier).name ?? "",
        ) &&
        declName != null &&
        ERROR_NAME_PATTERN.test(declName)
      ) {
        context.report({
          node,
          messageId: "undiscriminatedError",
          data: { name: declName },
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
          data: { name: declName },
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
