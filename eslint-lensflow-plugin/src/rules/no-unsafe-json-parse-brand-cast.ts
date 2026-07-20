import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T03-newtypes-opaque.md");

function getCastTypeName(typeNode: TSESTree.TypeNode): string {
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "Identifier") {
    return typeNode.typeName.name;
  }
  if (typeNode.type === "TSTypeReference" && typeNode.typeName.type === "TSQualifiedName") {
    return typeNode.typeName.right.name;
  }
  if (typeNode.type === "TSIntersectionType") {
    return "(intersection)";
  }
  return "<unknown>";
}

function isBrandedTypePattern(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.length >= 2;
  }

  if (typeNode.type === "TSTypeReference") {
    const typeName = typeNode.typeName;
    if (typeName.type === "Identifier") return true;
    if (typeName.type === "TSQualifiedName") {
      return true;
    }
  }

  return false;
}

function isJsonParseCall(node: TSESTree.CallExpression): boolean {
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;
  if (
    callee.object.type === "Identifier" &&
    callee.object.name === "JSON" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "parse"
  ) {
    return true;
  }
  return false;
}

export default createRule({
  name: "no-unsafe-json-parse-brand-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting JSON.parse output directly to a branded type using `as`.",
    },
    messages: {
      unsafeBrandCast:
        "Casting a value derived from JSON.parse to branded type `{{typeName}}` is unsafe — JSON deserialization bypasses brand validation. Use the branded type's smart constructor instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T03-newtypes-opaque.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unsafeBrandCast", []>) {
    const sourceCode = context.sourceCode;

    function originatesFromJsonParse(
      node: TSESTree.Expression,
      visitedIds: Set<string> = new Set(),
    ): boolean {
      if (node.type === "CallExpression" && isJsonParseCall(node)) return true;

      if (node.type === "MemberExpression") {
        return originatesFromJsonParse(node.object, visitedIds);
      }

      if (
        node.type === "TSAsExpression" ||
        node.type === "TSNonNullExpression" ||
        node.type === "TSSatisfiesExpression"
      ) {
        return originatesFromJsonParse(node.expression, visitedIds);
      }

      if (node.type === "ChainExpression") {
        return originatesFromJsonParse(node.expression, visitedIds);
      }

      if (node.type === "Identifier") {
        if (visitedIds.has(node.name)) return false;
        visitedIds.add(node.name);

        const scope = sourceCode.getScope(node);
        const variable = scope.variables.find(
          (v) => v.name === node.name && v.defs.length > 0,
        );
        if (!variable) return false;

        const targetLoc = node.loc.start;
        const writeSources: TSESTree.Expression[] = [];

        variable.defs.forEach((def) => {
          if (def.node.type === "VariableDeclarator" && def.node.init) {
            if (def.node.loc && def.node.loc.start.line <= targetLoc.line) {
              writeSources.push(def.node.init);
            }
          }
        });

        variable.references.forEach((ref) => {
          if (ref.isWrite() && ref.writeExpr) {
            if (
              ref.identifier.loc &&
              ref.identifier.loc.start.line <= targetLoc.line
            ) {
              writeSources.push(ref.writeExpr as unknown as TSESTree.Expression);
            }
          }
        });

        writeSources.sort((a, b) => {
          if (!a.loc || !b.loc) return 0;
          return a.loc.start.line - b.loc.start.line;
        });

        if (writeSources.length === 0) return false;

        return originatesFromJsonParse(writeSources[writeSources.length - 1], visitedIds);
      }

      return false;
    }

    return {
      TSAsExpression(node) {
        const castType = node.typeAnnotation;
        if (!isBrandedTypePattern(castType)) return;

        if (originatesFromJsonParse(node.expression)) {
          context.report({
            node,
            messageId: "unsafeBrandCast",
            data: { typeName: getCastTypeName(castType), url: URL },
          });
        }
      },
    };
  },
});
