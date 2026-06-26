import type { TSESLint } from "@typescript-eslint/utils";

/**
 * Walks the scope chain upward from the given scope checking for a variable
 * with the specified name.
 */
export function findVariableInScopeChain(
  scope: TSESLint.Scope.Scope | null,
  variableName: string,
): boolean {
  let currentScope: TSESLint.Scope.Scope | null = scope;
  while (currentScope) {
    if (currentScope.variables.some((v) => v.name === variableName)) {
      return true;
    }
    currentScope = currentScope.upper;
  }
  return false;
}

/**
 * Derives the expected schema variable name from a type/interface name
 * using the convention `{Name}Schema`.
 */
export function deriveSchemaName(typeName: string): string {
  return `${typeName}Schema`;
}
