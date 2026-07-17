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
 * Walks a member expression chain (possibly with intermediate calls) down to
 * the root identifier, e.g. `z.object({}).optional()` -> `"z"`.
 */
function getRootCalleeIdentifier(node: TSESTree.Expression): string | null {
  let current: TSESTree.Expression = node;

  while (current) {
    if (current.type === "MemberExpression") {
      current = current.object;
    } else if (current.type === "CallExpression") {
      current = current.callee;
    } else if (current.type === "TSAsExpression") {
      current = current.expression;
    } else if (current.type === "TSTypeAssertion") {
      current = current.expression;
    } else if (current.type === "Identifier") {
      return current.name;
    } else if (current.type === "TSNonNullExpression") {
      current = current.expression;
    } else {
      return null;
    }
  }

  return null;
}

/**
 * Checks if a call expression's callee matches common Zod schema-building
 * patterns by verifying the call chain originates from a `z` identifier
 * (e.g. `z.object(...)`, `z.string()`, `z.object({}).optional()`, etc.).
 */
function isZodLikeCall(node: TSESTree.CallExpression): boolean {
  const root = getRootCalleeIdentifier(node.callee);
  return root === "z";
}

/**
 * Heuristic: determines if a variable appears to be a Zod schema definition
 * rather than an arbitrarily named variable.  Only accepts call expressions
 * whose call chain originates from a `z` callee (e.g. `z.object(...)`,
 * `z.string()`, `z.object({}).optional()`).  Bare identifier assignments are
 * *not* accepted because we cannot verify they reference a Zod schema.
 */
export function looksLikeZodSchema(
  variable: TSESLint.Scope.Variable,
): boolean {
  for (const def of variable.defs) {
    if (def.node.type === "VariableDeclarator" && def.node.init) {
      const init = def.node.init;

      // Unwrap parentheses so `const x = (z.object({}))` still works.
      let unwrapped = init;
      if (init.type === "TSAsExpression" || init.type === "TSTypeAssertion") {
        unwrapped = init.expression;
      }

      if (unwrapped.type === "CallExpression") {
        return isZodLikeCall(unwrapped);
      }
    }
  }

  return false;
}
