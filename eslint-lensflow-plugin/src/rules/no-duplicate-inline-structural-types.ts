import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type Entry = {
  canonical: string;
  node: TSESTree.TSTypeLiteral;
};

function getTypeName(name: TSESTree.EntityName | TSESTree.TSQualifiedName): string {
  if (name.type === "Identifier") return name.name;
  if (name.type === "TSQualifiedName") {
    return `${getTypeName(name.left)}.${name.right.name}`;
  }
  return name.type;
}

function serializeTypeNode(node: TSESTree.TypeNode): string {
  switch (node.type) {
    case "TSTypeReference":
      return getTypeName(node.typeName);
    case "TSTypeLiteral":
      return canonicalize(node);
    case "TSLiteralType": {
      const lit = node.literal;
      if (lit.type === "Literal") return String(lit.value);
      if (lit.type === "TemplateLiteral") return lit.quasis.map((q) => q.value.cooked ?? "").join("");
      if (lit.type === "UnaryExpression") {
        const arg = lit.argument;
        const value = arg.type === "Literal" ? String(arg.value) : "";
        return `${lit.operator}${value}`;
      }
      return (lit as { type: string }).type;
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
      const tl = node as TSESTree.TSTemplateLiteralType;
      const parts: string[] = [];
      for (let i = 0; i < tl.quasis.length; i++) {
        parts.push(tl.quasis[i].value.cooked ?? "");
        if (i < tl.types.length) {
          parts.push(`${serializeTypeNode(tl.types[i])}`);
        }
      }
      return `\`${parts.join("")}\``;
    }
    case "TSTupleType":
      return `[${node.elementTypes.map(serializeTypeNode).join(",")}]`;
    case "TSNamedTupleMember": {
      const nm = node as TSESTree.TSNamedTupleMember;
      const mods = [nm.optional ? "?" : ""].filter(Boolean).join("");
      return `${nm.label.name}: ${serializeTypeNode(nm.elementType)}${mods}`;
    }
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSBigIntKeyword":
      return "bigint";
    case "TSBooleanKeyword":
      return "boolean";
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSVoidKeyword":
      return "void";
    case "TSSymbolKeyword":
      return "symbol";
    case "TSNeverKeyword":
      return "never";
    case "TSObjectKeyword":
      return "object";
    case "TSTypeOperator":
      return `type ${serializeTypeNode((node as TSESTree.TSTypeOperator).typeAnnotation as TSESTree.TypeNode)}`;
    case "TSConstructorType": {
      const ct = node as TSESTree.TSConstructorType;
      const params = ct.params.map(paramToString).join(",");
      const ret = ct.returnType ? serializeTypeAnnotation(ct.returnType) : "unknown";
      return `new(${params}):${ret}`;
    }
    case "TSFunctionType": {
      const ft = node as TSESTree.TSFunctionType;
      const params = ft.params.map(paramToString).join(",");
      const ret = ft.returnType ? serializeTypeAnnotation(ft.returnType) : "void";
      return `(${params}):${ret}`;
    }
    default:
      return `__${node.type}__`;
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
  if (p.type === "TSParameterProperty") {
    const inner = p.parameter;
    const name = inner.type === "Identifier" ? inner.name : inner.type;
    const ann = inner.typeAnnotation;
    const typeStr = ann ? serializeTypeAnnotation(ann) : "unknown";
    return `${name}:${typeStr}`;
  }
  const name = p.type === "Identifier" ? p.name : p.type;
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
        "Duplicate inline structural type used {{count}} times. Extract this shape into a named interface or type alias.",
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
    const visited = new Set<number>();

    function processParamWithLiteral(param: TSESTree.Parameter) {
      let target: TSESTree.Identifier | undefined;
      if (param.type === "Identifier") {
        target = param;
      } else if (param.type === "AssignmentPattern" && param.left.type === "Identifier") {
        target = param.left;
      } else if (param.type === "RestElement" && param.argument.type === "Identifier") {
        target = param.argument;
      } else if (
        param.type === "TSParameterProperty" &&
        param.parameter.type === "Identifier"
      ) {
        target = param.parameter;
      }

      const lit = target?.typeAnnotation?.typeAnnotation;
      if (lit?.type === "TSTypeLiteral" && lit.members.length > 0) {
        entries.push({ canonical: canonicalize(lit), node: lit });
      }
    }

    function checkParams(
      params: ReadonlyArray<TSESTree.Parameter>,
      nodeStart?: number,
    ) {
      if (nodeStart !== undefined && visited.has(nodeStart)) return;
      if (nodeStart !== undefined) visited.add(nodeStart);
      for (const param of params) {
        processParamWithLiteral(param);
      }
    }

    return {
      FunctionDeclaration(node) {
        checkParams(node.params, node.range[0]);
      },
      FunctionExpression(node) {
        checkParams(node.params, node.range[0]);
      },
      ArrowFunctionExpression(node) {
        checkParams(node.params, node.range[0]);
      },
      MethodDefinition(node) {
        if (node.value.type === "FunctionExpression") {
          checkParams(node.value.params, node.value.range[0]);
        }
      },
      TSDeclareFunction(node) {
        checkParams(node.params, node.range[0]);
      },
      TSFunctionType(node) {
        checkParams(node.params, node.range[0]);
      },
      TSConstructorType(node) {
        checkParams(node.params, node.range[0]);
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
