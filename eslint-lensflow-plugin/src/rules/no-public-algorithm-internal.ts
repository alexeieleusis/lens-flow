import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

const INTERNAL_NAME_PATTERN =
  /^(?:buffer|cache|state|internal|_internal|accumulator|_pool)$/;

const COLLECTION_TYPES = new Set(["Map", "Set", "WeakMap", "WeakSet"]);

function isPublicProperty(node: TSESTree.PropertyDefinition): boolean {
  if (node.accessibility === "private" || node.accessibility === "protected") {
    return false;
  }
  if (node.key.type === "PrivateIdentifier") {
    return false;
  }
  return true;
}

function isMatchingName(node: TSESTree.PropertyDefinition): string | null {
  if (node.key.type !== "Identifier") return null;
  const name = node.key.name;
  return INTERNAL_NAME_PATTERN.test(name) ? name : null;
}

function isMatchingType(node: TSESTree.PropertyDefinition): boolean {
  const ta = node.typeAnnotation?.typeAnnotation;
  if (!ta) return false;

  if (ta.type === "TSArrayType") return true;
  if (ta.type === "TSTypeLiteral") return true;

  if (ta.type === "TSTypeReference") {
    const typeName = ta.typeName;
    if (typeName.type === "Identifier") {
      return COLLECTION_TYPES.has(typeName.name);
    }
    if (typeName.type === "TSQualifiedName") {
      return COLLECTION_TYPES.has(typeName.right.name);
    }
  }

  return false;
}

function hasMethodAccessingProperty(classBody: TSESTree.ClassBody, propertyName: string): boolean {
  for (const member of classBody.body) {
    if (
      member.type === "MethodDefinition" &&
      member.value.body
    ) {
      if (
        walkNodes(member.value.body, (node) => {
          return (
            node.type === "MemberExpression" &&
            node.object.type === "ThisExpression" &&
            node.property.type === "Identifier" &&
            node.property.name === propertyName
          );
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

export default createRule({
  name: "no-public-algorithm-internal",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow public class fields that expose internal algorithm state (buffer, cache, accumulator, etc.).",
    },
    messages: {
      publicInternalState:
        "The field '{{name}}' exposes internal algorithm state as public. Make it private (#{{name}}) to prevent callers from bypassing or corrupting the algorithm. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"publicInternalState", []>) {
    return {
      ClassBody(node) {
        const flagged = node.body.filter((member) => {
          if (member.type !== "PropertyDefinition") return false;
          if (!isPublicProperty(member)) return false;
          const propName = isMatchingName(member);
          if (!propName) return false;
          if (!isMatchingType(member)) return false;
          if (!hasMethodAccessingProperty(node, propName)) return false;
          return true;
        });

        for (const member of flagged) {
          const propDef = member as TSESTree.PropertyDefinition;
          const propName =
            propDef.key.type === "Identifier" ? propDef.key.name : "?";
          context.report({
            node: member,
            messageId: "publicInternalState",
            data: { name: propName },
          });
        }
      },
    };
  },
});
