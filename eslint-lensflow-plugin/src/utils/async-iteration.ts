import ts from "typescript";
import type { TSESLint } from "@typescript-eslint/utils";

export const ASYNC_ITERATION_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T64-async-iteration.md";

export function hasAsyncIteratorSignature(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  // Use getApparentProperties() which traverses the type hierarchy,
  // unlike getProperties() which only returns direct instance properties.
  // This correctly detects inherited [Symbol.asyncIterator] implementations.
  const prop = type.getApparentProperties().find((p) =>
    p.escapedName === "[Symbol.asyncIterator]",
  );
  if (!prop || !prop.valueDeclaration) return false;

  const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
  return propType.getCallSignatures().length > 0;
}

export function findVariableInScopeChain(
  scope: TSESLint.Scope.Scope,
  name: string,
): TSESLint.Scope.Variable | null {
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    const variable = current.set.get(name);
    if (variable) return variable;
    current = current.upper;
  }
  return null;
}
