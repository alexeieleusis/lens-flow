import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T26-refinement-types.md";

function getKeyName(key: TSESTree.Expression | TSESTree.PrivateIdentifier): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function isBrandKeyName(name: string): boolean {
  if (name === "_brand" || name === "__brand") return true;
  return /[a-z]Brand$/.test(name);
}

function isBrandedIntersection(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type !== "TSIntersectionType") return false;
  return typeNode.types.some((t) => {
    if (t.type !== "TSTypeLiteral") return false;
    return t.members.some(
      (m) =>
        m.type === "TSPropertySignature" &&
        isBrandKeyName(getKeyName(m.key) ?? ""),
    );
  });
}

function isPascalCaseIdentifier(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some((t) => isPascalCaseIdentifier(t));
  }
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.some((t) => isPascalCaseIdentifier(t));
  }
  if (typeNode.type !== "TSTypeReference") return false;
  const tn = typeNode.typeName;
  return (
    tn.type === "Identifier" && /^[A-Z][A-Za-z0-9]/.test(tn.name)
  );
}

function isPotentiallyBrandedType(typeNode: TSESTree.TypeNode): boolean {
  return isBrandedIntersection(typeNode) || isPascalCaseIdentifier(typeNode);
}

function hasThrowStatement(body: TSESTree.BlockStatement): boolean {
  const visited = new Set<object>();

  function walkChild(child: unknown): boolean {
    if (child && typeof child === "object" && "type" in child) {
      return walk(child as TSESTree.Node);
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && "type" in item) {
          if (walk(item as TSESTree.Node)) return true;
        }
      }
    }
    return false;
  }

  function walk(node: TSESTree.Node): boolean {
    if (visited.has(node)) return false;
    visited.add(node);
    if (node.type === "ThrowStatement") return true;

    // Stop at function boundaries — nested functions belong to a different scope.
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      return false;
    }

    for (const key of Object.keys(node)) {
      if (key === "parent") continue;
      const child = (node as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (walkChild(child)) return true;
      }
    }
    return false;
  }

  return walk(body);
}

function hasErrorInUnion(types: TSESTree.TypeNode[]): boolean {
  return types.some((t) => {
    if (t.type !== "TSTypeReference") return false;
    const tn = t.typeName;
    if (tn.type === "Identifier" && tn.name === "Error") return true;
    if (
      tn.type === "TSQualifiedName" &&
      tn.right.type === "Identifier" &&
      tn.right.name === "Error"
    )
      return true;
    return false;
  });
}

function hasBrandedInUnion(types: TSESTree.TypeNode[]): boolean {
  return types.some((t) => isPotentiallyBrandedType(t));
}

function classifyStrategy(
  returnType: TSESTree.TypeNode | undefined,
  body: TSESTree.BlockStatement,
): "throwing" | "result-returning" | null {
  if (!returnType) return null;

  if (returnType.type === "TSUnionType") {
    const hasError = hasErrorInUnion(returnType.types);
    const hasBranded = hasBrandedInUnion(returnType.types);

    if (hasError && hasBranded) return "result-returning";
    if (hasBranded) return hasThrowStatement(body) ? "throwing" : null;
    return null;
  }

  if (isPotentiallyBrandedType(returnType)) {
    return "throwing";
  }

  return null;
}

type ConstructorFn = {
  name: string;
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression;
  strategy: "throwing" | "result-returning";
};

export default createRule({
  name: "consistent-constructor-strategy",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce consistent error-handling strategy across smart constructors in the same module — either all throw or all return result unions.",
    },
    messages: {
      inconsistent:
        "Inconsistent constructor strategy in this module. Throwing: {{throwing}}. Result-returning: {{resultReturning}}. Pick one strategy: either all constructors throw, or all return a result union. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"inconsistent", []>) {
    const sourceCode = context.sourceCode;
    const constructors: ConstructorFn[] = [];

    function classifyAndCollect(
      name: string,
      fn:
        | TSESTree.FunctionDeclaration
        | TSESTree.ArrowFunctionExpression
        | TSESTree.FunctionExpression,
    ): void {
      const returnType = fn.returnType?.typeAnnotation;
      const body = fn.body;
      if (body?.type === "BlockStatement") {
        const strategy = classifyStrategy(returnType, body);
        if (strategy) {
          constructors.push({ name, node: fn, strategy });
        }
      }
    }

    function processVarDeclarations(
      decls: readonly TSESTree.VariableDeclarator[],
    ): void {
      for (const decl of decls) {
        if (decl.id.type !== "Identifier") continue;
        if (
          decl.init &&
          (decl.init.type === "ArrowFunctionExpression" ||
            decl.init.type === "FunctionExpression")
        ) {
          classifyAndCollect(decl.id.name, decl.init);
        }
      }
    }

    function processStmt(stmt: TSESTree.Statement): void {
      if (stmt.type === "FunctionDeclaration" && stmt.id) {
        classifyAndCollect(stmt.id.name, stmt);
        return;
      }

      if (stmt.type === "VariableDeclaration") {
        processVarDeclarations(stmt.declarations);
        return;
      }

      if (
        stmt.type !== "ExportNamedDeclaration" &&
        stmt.type !== "ExportDefaultDeclaration"
      ) {
        return;
      }

      const decl = stmt.declaration;
      if (!decl) return;

      if (decl.type === "FunctionDeclaration" && decl.id) {
        classifyAndCollect(decl.id.name, decl);
      }
      if (decl.type === "VariableDeclaration") {
        processVarDeclarations(decl.declarations);
      }
    }

    for (const stmt of sourceCode.ast.body) {
      processStmt(stmt);
    }

    const throwing = constructors.filter((c) => c.strategy === "throwing");
    const resultReturning = constructors.filter(
      (c) => c.strategy === "result-returning",
    );

    if (throwing.length > 0 && resultReturning.length > 0) {
      for (const ctor of constructors) {
        context.report({
          node: ctor.node,
          messageId: "inconsistent",
          data: {
            throwing: throwing.map((c) => c.name).join(", "),
            resultReturning: resultReturning.map((c) => c.name).join(", "),
            url: URL,
          },
        });
      }
    }

    return {};
  },
});
