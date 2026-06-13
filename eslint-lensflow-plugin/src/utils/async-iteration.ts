import ts from "typescript";
import type { TSESLint } from "@typescript-eslint/utils";

export const ASYNC_ITERATION_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/ebff3754e7ddc862d05c3cd1a19480bdf52dfc25/plugin/skills/typescript/catalog/T64-async-iteration.md";

export function hasAsyncIteratorSignature(
  type: ts.Type,
  checker: ts.TypeChecker,
): boolean {
  // Use getApparentProperties() which traverses the type hierarchy,
  // unlike getProperties() which only returns direct instance properties.
  // This correctly detects inherited [Symbol.asyncIterator] implementations.
  // TypeScript represents [Symbol.asyncIterator] as __@asyncIterator@<hash>
  // in escapedName, so we match the pattern instead of exact string.
  const prop = type.getApparentProperties().find((p) =>
    String(p.escapedName).startsWith("__@asyncIterator@"),
  );
  if (!prop || !prop.valueDeclaration) return false;

  const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
  return propType.getCallSignatures().length > 0;
}

export function findVariableInScopeChain(
  scope: TSESLint.Scope.Scope,
  name: string,
): TSESLint.Scope.Variable | undefined {
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    const variable = current.variables.find((v) => v.name === name);
    if (variable) return variable;
    current = current.upper;
  }
  return undefined;
}
