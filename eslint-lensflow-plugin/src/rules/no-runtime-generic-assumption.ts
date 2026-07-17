import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const runtimeMetadataProps = new Set([
  "constructor",
  "__typename",
  "__proto__",
  "prototype",
]);

function getTypeText(node: unknown): string {
  const n = node as { type: string; typeName?: { type: string; name?: string } };
  switch (n.type) {
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSObjectKeyword":
      return "object";
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSTypeReference":
      if (n.typeName?.type === "Identifier") {
        return n.typeName.name ?? "specific type";
      }
      return "specific type";
    default:
      return "specific type";
  }
}

function typeArgsContainTypeParam(
  typeArguments: unknown[],
  typeParamNames: Set<string>,
): boolean {
  for (const arg of typeArguments) {
    const argN = arg as { type?: string; typeName?: { name?: string } };
    if (
      argN.type === "TSTypeReference" &&
      argN.typeName?.name &&
      typeParamNames.has(argN.typeName.name)
    ) {
      return true;
    }
  }
  return false;
}

function getGenericParamNames(node: unknown): string[] {
  const n = node as {
    params?: Array<{
      type: string;
      name?: string;
      typeAnnotation?: {
        typeAnnotation?: {
          type: string;
          typeName?: { name?: string };
          typeArguments?: { params?: unknown[] };
        };
      };
    }>;
    typeParameters?: { params: Array<{ name: { name: string } }> };
  };
  if (!n.params || !n.typeParameters) return [];
  const typeParamNames = new Set(
    n.typeParameters.params.map((tp) => tp.name.name),
  );
  const result: string[] = [];
  for (const p of n.params) {
    if (p.type !== "Identifier" || !p.name) continue;
    const ta = p.typeAnnotation?.typeAnnotation;
    if (!ta) continue;
    if (
      ta.type === "TSTypeReference" &&
      (
        (ta.typeName?.name && typeParamNames.has(ta.typeName.name)) ||
        (ta.typeArguments?.params &&
          typeArgsContainTypeParam(ta.typeArguments.params, typeParamNames))
      )
    ) {
      result.push(p.name);
    }
  }
  return result;
}

function getAllParamNames(node: unknown): string[] {
  const n = node as { params?: Array<{ type: string; name?: string }> };
  if (!n.params) return [];
  const result: string[] = [];
  for (const p of n.params) {
    if (p.type === "Identifier" && p.name) {
      result.push(p.name);
    }
  }
  return result;
}

export default createRule({
  name: "no-runtime-generic-assumption",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows accessing runtime type-metadata properties on generic parameters",
    },
    messages: {
      runtimeMetadataAccess:
        "Accessing {{property}} on generic parameter {{paramName}} which has no runtime type information. Use instanceof or type guards instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
      unsafeCastOnGeneric:
        "Casting generic parameter {{paramName}} to a specific type {{castType}} assumes runtime type information that does not exist. Use type guards instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
      runtimeMetadataOnCall:
        "Accessing {{property}} on the result of generic function {{funcName}}. Generic type T is erased at runtime. Use instanceof or type guards instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"runtimeMetadataAccess" | "runtimeMetadataOnCall" | "unsafeCastOnGeneric", []>) {
    const scopeStack: { genericFns: Set<string>; params: Map<string, boolean> }[] = [];

    function isGenericParam(name: string): boolean {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const params = scopeStack[i].params;
        if (params.has(name)) return params.get(name)!;
      }
      return false;
    }

    function isGenericFn(callee: TSESTree.Identifier): boolean {
      const scope = context.sourceCode.getScope(callee);
      let found: { identifiers: TSESTree.Identifier[]; name: string } | undefined;
      let currentScope: TSESLint.Scope.Scope | null = scope;
      while (currentScope) {
        for (const v of currentScope.variables) {
          if (v.name === callee.name) {
            found = v as { identifiers: TSESTree.Identifier[]; name: string };
            break;
          }
        }
        if (found) break;
        currentScope = currentScope.upper;
      }
      if (!found) return false;
      for (const id of found.identifiers) {
        const parent = (id as { parent?: unknown }).parent;
        if (!parent) continue;
        const p = parent as {
          type: string;
          typeParameters?: { params: unknown[] };
          init?: { type: string; typeParameters?: { params: unknown[] } };
        };
        const fnNode = p.type === "VariableDeclarator" ? p.init : p;
        if (
          fnNode &&
          (fnNode.type === "FunctionDeclaration" ||
            fnNode.type === "FunctionExpression" ||
            fnNode.type === "ArrowFunctionExpression") &&
          fnNode.typeParameters &&
          fnNode.typeParameters.params.length > 0
        ) {
          return true;
        }
      }
      return false;
    }

    function getBaseIdentifier(node: TSESTree.MemberExpression): TSESTree.Identifier | null {
      let current: TSESTree.Expression = node;
      while (current.type === "MemberExpression") {
        current = (current as TSESTree.MemberExpression).object;
      }
      if (current.type === "Identifier") {
        return current as TSESTree.Identifier;
      }
      return null;
    }

    function enterFn(node: unknown) {
      const n = node as {
        id?: { name: string };
        typeParameters?: { params: unknown[] };
      };
      const hasTypeParams =
        n.typeParameters && n.typeParameters.params.length > 0;
      const outerGenericFns =
        scopeStack.length > 0 ? scopeStack[scopeStack.length - 1].genericFns : new Set<string>();
      const currentGenericFns = new Set(outerGenericFns);
      if (hasTypeParams && n.id) {
        currentGenericFns.add(n.id.name);
      }
      const allParamNames = getAllParamNames(node);
      const genericParamNames = new Set(getGenericParamNames(node));
      const params = new Map<string, boolean>();
      for (const name of allParamNames) {
        params.set(name, genericParamNames.has(name));
      }
      scopeStack.push({ genericFns: currentGenericFns, params });
    }

    function exitFn() {
      scopeStack.pop();
    }

    return {
      FunctionDeclaration: enterFn,
      "FunctionDeclaration:exit": exitFn,

      FunctionExpression: enterFn,
      "FunctionExpression:exit": exitFn,

      ArrowFunctionExpression: enterFn,
      "ArrowFunctionExpression:exit": exitFn,

      MemberExpression(node: TSESTree.MemberExpression) {
        const mn = node as {
          object: { type: string; name?: string; callee?: { type: string; name?: string } };
          property: { type: string; name: string };
        };
        const property = mn.property;
        if (
          property.type !== "Identifier" ||
          !runtimeMetadataProps.has(property.name)
        ) {
          return;
        }

        let obj = mn.object as TSESTree.Expression;

        // Unwrap ChainExpression (optional chaining) to reach the inner expression
        if (obj.type === "ChainExpression") {
          obj = (obj as TSESTree.ChainExpression).expression;
        }

        if (obj.type === "Identifier" && obj.name) {
          if (isGenericParam(obj.name)) {
            context.report({
              node,
              messageId: "runtimeMetadataAccess",
              data: {
                property: property.name,
                paramName: obj.name,
              },
            });
            return;
          }
        }

        if (obj.type === "CallExpression") {
          const callObj = obj as TSESTree.CallExpression;
          let callee = callObj.callee;
          // Unwrap ChainExpression around the callee
          if (callee.type === "ChainExpression") {
            callee = (callee as TSESTree.ChainExpression).expression;
          }
          if (callee?.type === "Identifier" && isGenericFn(callee)) {
            context.report({
              node,
              messageId: "runtimeMetadataOnCall",
              data: {
                property: property.name,
                funcName: callee.name,
              },
            });
            return;
          }
          // Handle nested MemberExpression callees like factory.create<T>().constructor
          if (callee?.type === "MemberExpression") {
            const memCallee = callee as TSESTree.MemberExpression;
            const baseIdentifier = getBaseIdentifier(memCallee);
            if (baseIdentifier && isGenericFn(baseIdentifier)) {
              context.report({
                node,
                messageId: "runtimeMetadataOnCall",
                data: {
                  property: property.name,
                  funcName: baseIdentifier.name,
                },
              });
              return;
            }
          }
        }
      },

      TSAsExpression(node: TSESTree.TSAsExpression) {
        const an = node as {
          expression: { type: string; name?: string };
          typeAnnotation: unknown;
        };
        const expression = an.expression;
        if (expression.type !== "Identifier" || !expression.name) return;

        if (isGenericParam(expression.name)) {
          context.report({
            node,
            messageId: "unsafeCastOnGeneric",
            data: {
              paramName: expression.name,
              castType: getTypeText(an.typeAnnotation),
            },
          });
        }
      },
    };
  },
});
