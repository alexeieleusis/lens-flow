import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T06-derivation.md");

function getExprNameIdentifier(node: TSESTree.TSTypeQuery): string | null {
  const { exprName } = node;
  if (exprName.type === "Identifier") {
    return exprName.name;
  }
  if (exprName.type === "TSQualifiedName") {
    return exprName.right.name;
  }
  return null;
}

function findVariable(
  scope: TSESLint.Scope.Scope,
  name: string,
): TSESLint.Scope.Variable | null {
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    const found = current.variables.find(
      (v) => v.name === name && v.defs.length > 0,
    );
    if (found) return found;
    current = current.upper ?? null;
  }
  return null;
}

function hasAsConst(init: TSESTree.Expression | null): boolean {
  if (init?.type !== "TSAsExpression") return false;
  const ta = init.typeAnnotation;
  if (
    ta.type === "TSTypeReference" &&
    ta.typeName.type === "Identifier" &&
    ta.typeName.name === "const"
  )
    return true;
  return false;
}

function isObjectOrArrayLiteral(init: TSESTree.Expression | null): boolean {
  return (
    init !== null &&
    (init.type === "ObjectExpression" || init.type === "ArrayExpression")
  );
}

export default createRule({
  name: "no-typeof-mutable",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `typeof` on mutable variables (`let`/`var`) or `const` without `as const`.",
    },
    messages: {
      mutableLetVar:
        "`typeof` on `{{name}}` which is declared with `{{kind}}`. The runtime value can be reassigned and the derived type will silently drift. Declare with `const ... as const` instead. See: {{url}}",
      missingAsConst:
        "`typeof` on `{{name}}` declared with `const` but missing `as const` assertion. The object's properties will widen to non-literal types. Add `as const` to freeze the type. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableLetVar" | "missingAsConst", []>) {
    return {
      TSTypeQuery(node) {
        const varName = getExprNameIdentifier(node);
        if (!varName) return;

        const scope = context.sourceCode.getScope(node);
        const found = findVariable(scope, varName);

        if (!found) return;

        const def = found.defs[0];
        if (def.type !== "Variable") return;

        const declarator = def.node;
        const parent = declarator.parent;
        const init = declarator.init;

        if (parent.kind !== "const") {
          context.report({
            node,
            messageId: "mutableLetVar",
            data: {
               name: varName,
               kind: parent.kind,
               url: URL,
             },
          });
        } else if (isObjectOrArrayLiteral(init) && !hasAsConst(init)) {
          context.report({
            node,
            messageId: "missingAsConst",
            data: {
              name: varName,
              url: URL,
            },
          });
        }
      },
    };
  },
});
