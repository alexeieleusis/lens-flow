import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "no-deep-inheritance-chain",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deep class inheritance chains that indicate inheritance explosion instead of composition via interfaces.",
    },
    messages: {
      deepChain:
        "Class \"{{name}}\" has an inheritance chain of depth {{depth}} (threshold: {{maxDepth}}). Consider using composition via interfaces instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T36-trait-objects.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ maxDepth: 3 }],
  create(context: TSESLint.RuleContext<"deepChain", [{ maxDepth: number }]>) {
    const [{ maxDepth = 3 } = {}] = context.options;

    const classMap = new Map<string, string>();

    return {
      ClassDeclaration(node) {
        if (node.parent?.type === "Program" && node.superClass?.type === "Identifier" && node.id) {
          classMap.set(node.id.name, node.superClass.name);
        }
      },

      "Program:exit"() {
        for (const [className, superClass] of classMap) {
          let depth = 1;
          let current = superClass;
          const visited = new Set<string>([className]);
          while (classMap.has(current) && !visited.has(current)) {
            visited.add(current);
            depth++;
            current = classMap.get(current)!;
          }
          if (depth >= maxDepth) {
            const classNode = context.sourceCode.ast.body.find(
              (n): n is TSESTree.ClassDeclaration & { id: TSESTree.Identifier } =>
                n.type === "ClassDeclaration" && n.id !== null && n.id.name === className,
            );
            if (classNode) {
              context.report({
                node: classNode,
                messageId: "deepChain",
                data: {
                  name: className,
                  depth: String(depth),
                  maxDepth: String(maxDepth),
                },
              });
            }
          }
        }
      },
    };
  },
});
