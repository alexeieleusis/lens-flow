import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

/**
 * Walks the scope chain upward from the given scope checking for a variable
 * with the specified name. Stops at function or class scope boundaries to
 * avoid matching unrelated schemas from outer (e.g. module-level) scopes.
 * Returns the variable if found, null otherwise.
 */
export function findVariableInScopeChain(
  scope: TSESLint.Scope.Scope | null,
  variableName: string,
): TSESLint.Scope.Variable | null {
  let currentScope: TSESLint.Scope.Scope | null = scope;
  while (currentScope) {
    const variable = currentScope.variables.find((v) => v.name === variableName);
    if (variable) {
      return variable;
    }

    // Stop before walking into function or class scopes — a schema defined
    // in an unrelated function or at module level should not match an
    // interface nested inside a different function or class method.
    if (
      currentScope.type === "function" ||
      currentScope.type === "class"
    ) {
      break;
    }

    // Also stop if the next scope up is module-level — module-scoped
    // variables from unrelated code should not be matched.
    if (currentScope.upper?.type === "module") {
      break;
    }

    currentScope = currentScope.upper;
  }
  return null;
}

/**
 * Derives the expected schema variable name from a type/interface name
 * using the convention `{Name}Schema`.
 */
export function deriveSchemaName(typeName: string): string {
  return `${typeName}Schema`;
}

/**
 * Checks if a call expression's callee matches common Zod schema-building
 * patterns like `.object()`, `.array()`, `.string()`, `.number()`, etc.
 */
function isZodLikeCall(node: TSESTree.CallExpression): boolean {
  const callee = node.callee;

  if (callee.type === "MemberExpression") {
    return true;
  }

  if (callee.type === "Identifier" && ["z", "Zod", "schema"].includes(callee.name)) {
    return true;
  }

  if (callee.type === "CallExpression") {
    return isZodLikeCall(callee);
  }

  return false;
}

/**
 * Heuristic: determines if a variable appears to be a Zod schema definition
 * rather than an arbitrarily named variable.
 */
export function looksLikeZodSchema(
  variable: TSESLint.Scope.Variable,
): boolean {
  for (const def of variable.defs) {
    if (def.node.type === "VariableDeclarator" && def.node.init) {
      const init = def.node.init;

      if (init.type === "CallExpression") {
        return isZodLikeCall(init);
      }

      if (init.type === "Identifier") {
        return true;
      }
    }
  }

  return false;
}
