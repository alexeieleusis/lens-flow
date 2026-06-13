import { AST_NODE_TYPES, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function findVariableDeclarator(node: unknown): unknown {
  let current: unknown = node;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while (current) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = current as any;
    if (n.type === AST_NODE_TYPES.VariableDeclarator) return n;
    current = n?.parent;
  }
  return null;
}

function hasAsConst(node: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const declarator = node as any;
  const init = declarator.init;
  if (!init) return false;
  // Check: const x = ... as const  (parsed as TSTypeReference to "const")
  if (
    init.type === AST_NODE_TYPES.TSAsExpression &&
    init.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    init.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
    init.typeAnnotation.typeName.name === "const"
  ) {
    return true;
  }
  return false;
}

function hasReadonlyAnnotation(node: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const declarator = node as any;
  // Check direct type annotation: const x: Readonly<...> = ...
  if (declarator.id?.typeAnnotation) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ann = declarator.id.typeAnnotation;
    if (
      ann.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference &&
      ann.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
      ann.typeAnnotation.typeName.name === "Readonly"
    ) {
      return true;
    }
  }
  // Check: const x = ... as Readonly<...>
  if (declarator.init) {
    const init = declarator.init;
    if (
      init.type === AST_NODE_TYPES.TSAsExpression &&
      init.typeAnnotation?.type === AST_NODE_TYPES.TSTypeReference &&
      init.typeAnnotation.typeName?.type === AST_NODE_TYPES.Identifier &&
      init.typeAnnotation.typeName.name === "Readonly"
    ) {
      return true;
    }
  }
  return false;
}

export default createRule({
  name: "no-object-freeze-without-readonly-annotation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Object.freeze() without Readonly<T> type annotation or as const",
    },
    messages: {
      missingReadonly:
        "Object.freeze() provides runtime immutability but TypeScript does not infer readonly from it. Add `as const` or a `Readonly<T>` type annotation. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingReadonly", []>) {
    return {
      CallExpression(node) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const callee = node.callee as any;
        if (
          callee.type !== AST_NODE_TYPES.MemberExpression ||
          callee.object?.type !== AST_NODE_TYPES.Identifier ||
          callee.object.name !== "Object" ||
          callee.property?.type !== AST_NODE_TYPES.Identifier ||
          callee.property.name !== "freeze"
        ) {
          return;
        }

        const declarator = findVariableDeclarator(node);
        if (!declarator) return;

        if (hasAsConst(declarator) || hasReadonlyAnnotation(declarator)) return;

        context.report({
          node,
          messageId: "missingReadonly",
        });
      },
    };
  },
});
