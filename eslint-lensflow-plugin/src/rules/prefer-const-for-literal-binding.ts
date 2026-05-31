import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

export default createRule({
  name: "prefer-const-for-literal-binding",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer `const` over `let` for variables initialized with a literal value to preserve the literal type instead of widening to the primitive.",
    },
    messages: {
      preferConst:
        "Use `const` instead of `let` to preserve the literal type `{{literalType}}` instead of widening to `{{widenedType}}`. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T52-literal-types.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferConst", []>) {
    return {
      VariableDeclarator(node) {
        const parent = node.parent;
        if (
          parent?.type !== "VariableDeclaration" ||
          parent?.kind !== "let"
        ) {
          return;
        }

        if (node.init?.type !== "Literal") {
          return;
        }

        if (node.id.typeAnnotation) {
          return;
        }

        if (node.id.type !== "Identifier") {
          return;
        }

        // Skip if the variable is reassigned anywhere in its scope
        const varName = node.id.name;
        let currentScope = context.sourceCode.getScope(node);
        let variable = null;
        while (currentScope !== null) {
          variable = currentScope.variables.find((v) => v.name === varName) ?? null;
          if (variable) break;
          currentScope = currentScope.upper!;
        }
        if (variable?.references.some((ref) => ref.isWrite() && !ref.init)) {
          return;
        }

        const val = node.init.value;
        let literalType: string | number | null;
        if (typeof val === "string") {
          literalType = `"${val}"`;
        } else if (typeof val === "number") {
          literalType = val;
        } else if (typeof val === "boolean") {
          literalType = String(val);
        } else {
          literalType = null;
        }

        if (literalType === null) {
          return;
        }

        const widenedType = typeof val as "string" | "number" | "boolean";

        context.report({
          node: node.id,
          messageId: "preferConst",
          data: {
            literalType: String(literalType),
            widenedType,
          },
          fix(fixer) {
            const letToken = context.sourceCode.getFirstToken(parent);
            return letToken?.value === "let"
              ? fixer.replaceText(letToken, "const")
              : null;
          },
        });
      },
    };
  },
});
