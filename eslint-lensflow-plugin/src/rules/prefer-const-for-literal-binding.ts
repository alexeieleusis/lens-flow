import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

type WidenedPrimitive = "string" | "number" | "boolean";

function getLiteralInfo(
  init: TSESTree.Literal | TSESTree.TemplateLiteral
): { literalType: string | number; widenedType: WidenedPrimitive } | null {
  if (init.type === "TemplateLiteral") {
    if (init.expressions.length !== 0) return null;
    const cooked = init.quasis[0].value.cooked;
    if (cooked === null) return null;
    return { literalType: `"${cooked}"`, widenedType: "string" };
  }

  const val = init.value;
  let literalType: string | number | null;
  if (typeof val === "string") {
    literalType = `"${val}"`;
  } else if (typeof val === "number") {
    literalType = val;
  } else if (typeof val === "boolean") {
    literalType = String(val);
  } else {
    return null;
  }
  const widenedType = typeof val as WidenedPrimitive;
  return { literalType, widenedType };
}

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
        "Use `const` instead of `let` to preserve the literal type `{{literalType}}` instead of widening to `{{widenedType}}`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T52-literal-types.md",
    },
    schema: [],
    fixable: "code",
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferConst", []>) {
    const reportedDeclarations = new Set<number>();

    function isReassigned(declarator: TSESTree.VariableDeclarator, varName: string): boolean {
      let currentScope = context.sourceCode.getScope(declarator);
      let variable = null;
      while (currentScope !== null) {
        variable = currentScope.variables.find((v) => v.name === varName) ?? null;
        if (variable) break;
        currentScope = currentScope.upper!;
      }
      return variable?.references.some((ref) => ref.isWrite() && !ref.init) ?? false;
    }

    function isViolatingDeclarator(declarator: TSESTree.VariableDeclarator) {
      if (
        declarator.init?.type !== "Literal" &&
        declarator.init?.type !== "TemplateLiteral"
      )
        return null;
      if (declarator.id.typeAnnotation) return null;
      if (declarator.id.type !== "Identifier") return null;
      if (isReassigned(declarator, declarator.id.name)) return null;

      const info = getLiteralInfo(declarator.init);
      if (!info) return null;

      return {
        ...declarator,
        literalType: info.literalType,
        widenedType: info.widenedType,
      } as TSESTree.VariableDeclarator & {
        literalType: string | number;
        widenedType: WidenedPrimitive;
      };
    }

    function reportViolations(
      node: TSESTree.VariableDeclaration,
      violatingDeclarators: (TSESTree.VariableDeclarator & {
        literalType: string | number;
        widenedType: WidenedPrimitive;
      })[]
    ) {
      const letToken = context.sourceCode.getFirstToken(node);

      if (!letToken) {
        for (const decl of violatingDeclarators) {
          context.report({
            node: decl.id,
            messageId: "preferConst",
            data: {
              literalType: String(decl.literalType),
              widenedType: decl.widenedType,
            },
          });
        }
        return;
      }

      reportWithFix(node, letToken, violatingDeclarators);
    }

    function reportWithFix(
      node: TSESTree.VariableDeclaration,
      letToken: TSESTree.Token,
      violatingDeclarators: (TSESTree.VariableDeclarator & {
        literalType: string | number;
        widenedType: WidenedPrimitive;
      })[]
    ) {
      const hasFix = letToken.value === "let";

      for (let i = 0; i < violatingDeclarators.length; i++) {
        const decl = violatingDeclarators[i];
        context.report({
          node: decl.id,
          messageId: "preferConst",
          data: {
            literalType: String(decl.literalType),
            widenedType: decl.widenedType,
          },
          ...(i === 0 && hasFix
            ? {
                fix(fixer: TSESLint.RuleFixer) {
                  return fixer.replaceText(letToken, "const");
                },
              }
            : {}),
        });
      }
    }

    return {
      VariableDeclaration(node) {
        if (node.kind !== "let") {
          return;
        }

        if (reportedDeclarations.has(node.range[0])) {
          return;
        }

        const violatingDeclarators = node.declarations
          .map(isViolatingDeclarator)
          .filter(
            (d): d is TSESTree.VariableDeclarator & {
              literalType: string | number;
              widenedType: WidenedPrimitive;
            } => d !== null
          );

        if (violatingDeclarators.length === 0) {
          return;
        }

        reportedDeclarations.add(node.range[0]);
        reportViolations(node, violatingDeclarators);
      },
    };
  },
});
