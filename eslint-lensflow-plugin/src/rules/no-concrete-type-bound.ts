import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

const BUILT_IN_REFERENCES = new Set(["Error", "Object", "Record"]);

function extractTypeName(node: TSESTree.TSTypeReference): string | null {
  if (node.typeName.type === "Identifier") {
    return node.typeName.name;
  }
  if (node.typeName.type === "TSQualifiedName") {
    const rightmost = node.typeName.right;
    if (rightmost.type === "Identifier") {
      return rightmost.name;
    }
  }
  return null;
}

function isDisallowedName(name: string, allowed: Set<string>): boolean {
  return !allowed.has(name);
}

function findConcreteInMembers(
  members: TSESTree.TypeNode[],
  allowed: Set<string>,
): string | null {
  for (const member of members) {
    const name = findConcreteType(member, allowed);
    if (name) return name;
  }
  return null;
}

function findConcreteType(
  node: TSESTree.TypeNode,
  allowed: Set<string>,
): string | null {
  let current: TSESTree.TypeNode = node;

  while ((current as any).type === "TSParenthesizedType") {
    current = (current as any).typeAnnotation;
  }

  if (current.type === "TSTypeReference") {
    const name = extractTypeName(current);
    if (name && isDisallowedName(name, allowed)) return name;
    return null;
  }

  if (current.type === "TSUnionType") {
    return findConcreteInMembers(current.types, allowed);
  }

  if (current.type === "TSIntersectionType") {
    return findConcreteInMembers(current.types, allowed);
  }

  return null;
}

export default createRule({
  name: "no-concrete-type-bound",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic type parameters constrained by a concrete named type instead of a minimal structural shape",
    },
    messages: {
      concreteBound:
        "Generic parameter `{{param}}` is constrained by the concrete type `{{constraint}}` instead of a structural shape. Use an inline interface like `{{suggestion}}` to improve reusability. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedReferences: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ allowedReferences: [] as string[] }],
  create(context: TSESLint.RuleContext<"concreteBound", [{ allowedReferences?: string[] }]>) {
    const { allowedReferences = [] } = context.options[0] ?? {};
    const allowed = new Set([...BUILT_IN_REFERENCES, ...allowedReferences]);

    return {
      TSTypeParameter(node) {
        if (!node.constraint) return;

        const concrete = findConcreteType(node.constraint, allowed);
        if (!concrete) return;

        const paramName = node.name ? node.name.name : "T";

        context.report({
          node,
          messageId: "concreteBound",
          data: {
            param: paramName,
            constraint: concrete,
            suggestion: "{ /* minimal required shape */ }",
          },
        });
      },
    };
  },
});
