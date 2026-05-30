import ts from "typescript";
import type { TSESLint } from "@typescript-eslint/utils";

export const ASYNC_ITERATION_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T64-async-iteration.md";

export function hasAsyncIteratorSignature(type: ts.Type): boolean {
  for (const prop of type.getProperties()) {
    const name = prop.name;
    if (name === "[Symbol.asyncIterator]" || name.includes("asyncIterator")) {
      return true;
    }
  }
  return false;
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
