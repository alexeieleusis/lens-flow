import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type Entry = {
  canonical: string;
  node: TSESTree.TSTypeLiteral;
};

function getTypeName(node: TSESTree.EntityName): string {
  if (node.type === "Identifier") return node.name;
  if (node.type === "TSQualifiedName") {
    return `${getTypeName(node.left)}.${node.right.name}`;
  }
  return node.type;
}

function serializeTypeNode(node: TSESTree.TypeNode): string {
  if ((node as any).type === "TSParenthesizedType") {
    return serializeTypeNode((node as any).typeAnnotation);
  }
  switch (node.type) {
    case "TSTypeReference":
      return getTypeName(node.typeName);
    case "TSTypeLiteral":
      return canonicalize(node);
    case "TSLiteralType": {
      const lit = node.literal;
      if (lit.type === "Literal") return String(lit.value);
      if (lit.type === "UnaryExpression") {
        return `${lit.operator}${String((lit.argument as TSESTree.Literal).value)}`;
      }
      return lit.type;
    }
    case "TSUnionType":
      return `(${node.types.map(serializeTypeNode).join("|")})`;
    case "TSIntersectionType":
      return `(${node.types.map(serializeTypeNode).join("&")})`;
    case "TSArrayType":
      return `${serializeTypeNode(node.elementType)}[]`;
    case "TSOptionalType":
      return `${serializeTypeNode(node.typeAnnotation)}?`;
    case "TSRestType":
      return `...${serializeTypeNode(node.typeAnnotation)}`;
    case "TSIndexedAccessType":
      return `${serializeTypeNode(node.objectType)}[${serializeTypeNode(node.indexType)}]`;
    case "TSTemplateLiteralType": {
      const parts: string[] = [];
      for (const elem of node.quasis) {
        parts.push(elem.value.cooked ?? "");
      }
      return `\`${parts.join("")}\``;
    }
    case "TSTupleType":
      return `[${node.elementTypes.map(serializeTypeNode).join(",")}]`;
    case "TSNamedTupleMember":
      return `${node.label.name}: ${serializeTypeNode(node.elementType)}`;
    default:
      return node.type;
  }
}

function serializeTypeAnnotation(node: TSESTree.TSTypeAnnotation): string {
  if (node.typeAnnotation) {
    return serializeTypeNode(node.typeAnnotation);
  }
  return "unknown";
}

function memberKey(m: TSESTree.TSPropertySignature | TSESTree.TSMethodSignature): string {
  if (m.key.type === "Identifier") return m.key.name;
  if (m.key.type === "Literal") return String(m.key.value);
  return m.key.type;
}

function paramToString(p: TSESTree.Parameter): string {
  const name = p.type === "Identifier" ? p.name : p.type;
  if (p.type === "TSParameterProperty") {
    const ann = p.parameter.typeAnnotation;
    const typeStr = ann ? serializeTypeAnnotation(ann) : "unknown";
    return `${name}:${typeStr}`;
  }
  const typeAnn = p.typeAnnotation
    ? serializeTypeAnnotation(p.typeAnnotation)
    : "unknown";
  return `${name}:${typeAnn}`;
}

function canonicalize(node: TSESTree.TSTypeLiteral): string {
  const parts: string[] = [];

  for (const m of node.members) {
    if (m.type === "TSPropertySignature") {
      const typeAnn = m.typeAnnotation
        ? serializeTypeAnnotation(m.typeAnnotation)
        : "unknown";
      const mods = [m.readonly ? "R" : "", m.optional ? "?" : ""].filter(Boolean).join("");
      parts.push(`P:${memberKey(m)}:${typeAnn}${mods}`);
    } else if (m.type === "TSMethodSignature") {
      const params = m.params.map(paramToString).join(",");
      const ret = m.returnType
        ? serializeTypeAnnotation(m.returnType)
        : "void";
      const mods = [m.readonly ? "R" : "", m.optional ? "?" : ""].filter(Boolean).join("");
      parts.push(`M:${memberKey(m)}(${params}):${ret}${mods}`);
    } else if (m.type === "TSCallSignatureDeclaration") {
      const params = m.params.map(paramToString).join(",");
      const ret = m.returnType
        ? serializeTypeAnnotation(m.returnType)
        : "void";
      parts.push(`C(${params}):${ret}`);
    } else if (m.type === "TSConstructSignatureDeclaration") {
      const params = m.params.map(paramToString).join(",");
      const ret = m.returnType
        ? serializeTypeAnnotation(m.returnType)
        : "unknown";
      parts.push(`N(${params}):${ret}`);
    } else if (m.type === "TSIndexSignature") {
      const params = m.parameters.map(paramToString).join(",");
      const ret = m.typeAnnotation
        ? serializeTypeAnnotation(m.typeAnnotation)
        : "unknown";
      parts.push(`I(${params}):${ret}`);
    }
  }

  parts.sort();
  return parts.join("|");
}

export default createRule({
  name: "no-duplicate-inline-structural-types",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow repeating the same inline structural type across multiple function parameters",
    },
    messages: {
      duplicateInlineType:
        "Duplicate inline structural type used {{count}} times. Extract this shape into a named interface or type alias. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC05-structural-contracts.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          minDuplicates: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minDuplicates: 3 }],
  create(context: TSESLint.RuleContext<"duplicateInlineType", [{ minDuplicates: number }]>) {
    const [{ minDuplicates } = { minDuplicates: 3 }] = context.options ?? [];
    const entries: Entry[] = [];

    function checkParams(
      params: ReadonlyArray<TSESTree.Parameter>,
    ) {
      for (const param of params) {
        if (
          param.type === "Identifier" &&
          param.typeAnnotation?.typeAnnotation.type === "TSTypeLiteral"
        ) {
          const lit = param.typeAnnotation.typeAnnotation;
          entries.push({
            canonical: canonicalize(lit),
            node: lit,
          });
        } else if (
          param.type === "AssignmentPattern" &&
          param.left.type === "Identifier" &&
          param.left.typeAnnotation?.typeAnnotation.type === "TSTypeLiteral"
        ) {
          const lit = param.left.typeAnnotation.typeAnnotation;
          entries.push({
            canonical: canonicalize(lit),
            node: lit,
          });
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node.params);
      },
      FunctionExpression(node) {
        checkParams(node.params);
      },
      ArrowFunctionExpression(node) {
        checkParams(node.params);
      },
      "Program:exit"() {
        const groups = new Map<string, Entry[]>();
        for (const entry of entries) {
          const group = groups.get(entry.canonical) ?? [];
          group.push(entry);
          groups.set(entry.canonical, group);
        }

        for (const [, group] of groups) {
          if (group.length >= minDuplicates) {
            for (const entry of group) {
              context.report({
                node: entry.node,
                messageId: "duplicateInlineType",
                data: { count: String(group.length) },
              });
            }
          }
        }
      },
    };
  },
});
