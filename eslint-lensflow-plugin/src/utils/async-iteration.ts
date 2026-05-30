import ts from "typescript";
import type { Scope, ScopeVariable } from "@typescript-eslint/scope-manager";

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
  scope: Scope,
  name: string,
): ScopeVariable | null {
  let current: Scope | null = scope;
  while (current) {
    const variable = current.set.get(name);
    if (variable) return variable;
    current = current.upper;
  }
  return null;
}
