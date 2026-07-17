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
  if (node.key.type === "Identifier") {
    const name = node.key.name;
    return INTERNAL_NAME_PATTERN.test(name) ? name : null;
  }
  if (node.key.type === "Literal" && typeof node.key.value === "string") {
    return INTERNAL_NAME_PATTERN.test(node.key.value) ? node.key.value : null;
  }
  return null;
}

function matchesCollectionOrMutableType(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSArrayType") return true;
  if (typeNode.type === "TSTypeLiteral") return true;

  if (typeNode.type === "TSTypeReference") {
    const typeName = typeNode.typeName;
    if (typeName.type === "Identifier") {
      return COLLECTION_TYPES.has(typeName.name);
    }
    if (typeName.type === "TSQualifiedName") {
      return COLLECTION_TYPES.has(typeName.right.name);
    }
  }

  return false;
}

function isMatchingType(node: TSESTree.PropertyDefinition): boolean {
  const ta = node.typeAnnotation?.typeAnnotation;
  if (!ta) return false;

  return unwrapAndCheckType(ta);
}

function unwrapAndCheckType(typeNode: TSESTree.TypeNode): boolean {
  if (matchesCollectionOrMutableType(typeNode)) return true;

  // TSParenthesizedType exists at runtime but isn't in @typescript-eslint's TypeNode union.
  if ((typeNode as any).type === "TSParenthesizedType") {
    return unwrapAndCheckType((typeNode as any).typeAnnotation as TSESTree.TypeNode);
  }

  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some((member) => unwrapAndCheckType(member));
  }

  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.some((member) => unwrapAndCheckType(member));
  }

  return false;
}

function hasMethodAccessingProperty(classBody: TSESTree.ClassBody, propertyName: string): boolean {
  const accessesProperty = (body: TSESTree.Node) =>
    walkNodes(body, (node) => {
      return (
        node.type === "MemberExpression" &&
        node.object.type === "ThisExpression" &&
        node.property.type === "Identifier" &&
        node.property.name === propertyName
      );
    });

  for (const member of classBody.body) {
    if (member.type === "MethodDefinition" && member.value.body) {
      if (accessesProperty(member.value.body)) {
        return true;
      }
    }
    if (member.type === "PropertyDefinition") {
      if (propertyDefAccessesProperty(member, accessesProperty)) {
        return true;
      }
    }
  }
  return false;
}

function propertyDefAccessesProperty(
  member: TSESTree.PropertyDefinition,
  accessesProperty: (body: TSESTree.Node) => boolean
): boolean {
  if (!member.value) return false;
  if (member.value.type === "ArrowFunctionExpression") {
    return accessesProperty(member.value);
  }
  if (member.value.type === "FunctionExpression" && member.value.body) {
    return accessesProperty(member.value.body);
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
          let propName;
          if (propDef.key.type === "Identifier") {
            propName = propDef.key.name;
          } else if (propDef.key.type === "Literal" && typeof propDef.key.value === "string") {
            propName = propDef.key.value;
          } else {
            propName = "?";
          }
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
