import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-schema-inference",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer deriving types via `z.infer` over manually defining an interface that duplicates a nearby schema.",
    },
    messages: {
      redundantInterface:
        "Interface `{{interfaceName}}` is manually defined alongside schema `{{schemaName}}`. Derive the type with `type {{interfaceName}} = z.infer<typeof {{schemaName}}>` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T06-derivation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"redundantInterface", []>) {
    return {
      TSInterfaceDeclaration(node) {
        const interfaceName = node.id?.name;
        if (!interfaceName) return;

        const schemaVarName = `${interfaceName}Schema`;

        const hasPropertySignatures = node.body.body.some(
          (member) => member.type === "TSPropertySignature",
        );
        if (!hasPropertySignatures) return;

        const scope = context.sourceCode.getScope(node);
        if (!scope) return;
        let currentScope: typeof scope | null = scope;
        let found = false;

        while (currentScope && !found) {
          const hasSchema = currentScope.variables.some(
            (v) => v.name === schemaVarName,
          );
          if (hasSchema) {
            found = true;
          }
          currentScope = currentScope.upper;
        }

        if (found) {
          context.report({
            node,
            messageId: "redundantInterface",
            data: {
              interfaceName,
              schemaName: schemaVarName,
            },
          });
        }
      },
    };
  },
});
