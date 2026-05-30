import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getTypeName(typeName: TSESTree.Identifier | TSESTree.ThisExpression | TSESTree.TSQualifiedName): string | null {
  if (typeName.type === "Identifier") {
    return typeName.name;
  }
  if (typeName.type === "TSQualifiedName") {
    return typeName.right.name;
  }
  return null;
}

type SelfRef = { ancestors: TSESTree.TypeNode[] };

function isTSNode(value: unknown): value is TSESTree.Node {
  return (
    value != null &&
    typeof value === "object" &&
    "type" in value &&
    typeof (value as TSESTree.Node).type === "string" &&
    (value as TSESTree.Node).type.startsWith("TS")
  );
}

function isSkippableKey(key: string): boolean {
  return key === "loc" || key === "range" || key === "parent";
}

function getTSChildren(node: TSESTree.Node): TSESTree.Node[] {
  const children: TSESTree.Node[] = [];

  for (const key of Object.keys(node)) {
    if (isSkippableKey(key)) continue;
    const child = (node as unknown as Record<string, unknown>)[key];
    if (child == null || typeof child !== "object") continue;

    if (Array.isArray(child)) {
      for (const item of child) {
        if (isTSNode(item)) {
          children.push(item);
        }
      }
    } else if (isTSNode(child)) {
      children.push(child);
    }
  }

  return children;
}

function collectSelfRefs(
  node: TSESTree.Node,
  aliasName: string,
  ancestors: TSESTree.TypeNode[],
): SelfRef[] {
  const results: SelfRef[] = [];

  if (node.type === "TSTypeReference") {
    const name = getTypeName(node.typeName);
    if (name === aliasName) {
      results.push({ ancestors: [...ancestors] });
    }
  }

  const extendedAncestors = [...ancestors, node as TSESTree.TypeNode];
  for (const child of getTSChildren(node)) {
    results.push(...collectSelfRefs(child, aliasName, extendedAncestors));
  }

  return results;
}

export default createRule({
  name: "no-direct-circular-alias",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type aliases that directly reference themselves without object-property indirection",
    },
    messages: {
      directCircularReference:
        "Type alias '{{name}}' directly references itself, causing a TS2456 circular reference error. Wrap the reference in an object type, e.g. type {{name}} = { value: {{name}} }. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T23-type-aliases.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"directCircularReference", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const aliasName = node.id.name;
        const typeAnnotation = node.typeAnnotation;
        if (!typeAnnotation) return;

        const selfRefs = collectSelfRefs(typeAnnotation, aliasName, []);

        for (const ref of selfRefs) {
          const hasObjectIndirection = ref.ancestors.some(
            (anc) => anc.type === "TSTypeLiteral",
          );
          if (!hasObjectIndirection) {
            context.report({
              node,
              messageId: "directCircularReference",
              data: { name: aliasName },
            });
            return;
          }
        }
      },
    };
  },
});
