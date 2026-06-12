import ts from "typescript";

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
