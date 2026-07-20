import ts from "typescript";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";


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
  if (!prop?.valueDeclaration) return false;

  const propType = checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration);
  return propType.getCallSignatures().length > 0;
}

export function findVariableByReference(
  scope: TSESLint.Scope.Scope,
  identifier: TSESTree.Identifier,
): TSESLint.Scope.Variable | undefined {
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    const ref = current.references.find((r) => r.identifier === identifier);
    if (ref?.resolved) return ref.resolved;

    const throughRef = current.through.find(
      (r) => r.identifier === identifier,
    );
    if (throughRef?.resolved) return throughRef.resolved;

    current = current.upper;
  }
  return undefined;
}
