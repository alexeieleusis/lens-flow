import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC05-structural-contracts.md");

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

const KEYWORD_TYPE_MAP = {
  TSAnyKeyword: "any",
  TSUnknownKeyword: "unknown",
  TSStringKeyword: "string",
  TSNumberKeyword: "number",
  TSBigIntKeyword: "bigint",
  TSBooleanKeyword: "boolean",
  TSNullKeyword: "null",
  TSUndefinedKeyword: "undefined",
  TSVoidKeyword: "void",
  TSSymbolKeyword: "symbol",
  TSNeverKeyword: "never",
  TSObjectKeyword: "object",
};

function serializeLiteralType(node: TSESTree.TSLiteralType): string {
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

function serializeTemplateLiteralType(node: TSESTree.TSTemplateLiteralType): string {
  const parts: string[] = [];
  for (let i = 0; i < node.quasis.length; i++) {
    parts.push(node.quasis[i].value.cooked ?? "");
    if (i < node.types.length) {
      parts.push(serializeTypeNode(node.types[i]));
    }
  }
  return `\`${parts.join("")}\``;
}

function serializeCallableType(
  params: TSESTree.Parameter[],
  returnType: TSESTree.TSTypeAnnotation | null | undefined,
  prefix: string,
  defaultRet: string,
): string {
  const serializedParams = params.map(paramToString).join(",");
  const ret = returnType ? serializeTypeAnnotation(returnType) : defaultRet;
  return `${prefix}(${serializedParams}):${ret}`;
}

function serializeTypeNode(node: TSESTree.TypeNode): string {
  if (node.type in KEYWORD_TYPE_MAP) return KEYWORD_TYPE_MAP[node.type as keyof typeof KEYWORD_TYPE_MAP];

  switch (node.type) {
    case "TSTypeReference":
      return getTypeName(node.typeName);
    case "TSTypeLiteral":
      return canonicalize(node);
    case "TSLiteralType":
      return serializeLiteralType(node);
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
    case "TSTemplateLiteralType":
      return serializeTemplateLiteralType(node);
    case "TSTupleType":
      return `[${node.elementTypes.map(serializeTypeNode).join(",")}]`;
    case "TSNamedTupleMember":
      return serializeNamedTupleMember(node);
    case "TSTypeOperator":
      return `type ${serializeTypeNode(node.typeAnnotation as TSESTree.TypeNode)}`;
    case "TSConstructorType":
      return serializeCallableType(node.params, node.returnType, "new", "unknown");
    case "TSFunctionType":
      return serializeCallableType(node.params, node.returnType, "(", "void");
    default:
      return `__${node.type}__`;
  }
}

function serializeNamedTupleMember(node: TSESTree.TSNamedTupleMember): string {
  const mods = node.optional ? "?" : "";
  return `${node.label.name}: ${serializeTypeNode(node.elementType)}${mods}`;
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

function serializePropertySignature(m: TSESTree.TSPropertySignature): string {
  const typeAnn = m.typeAnnotation ? serializeTypeAnnotation(m.typeAnnotation) : "unknown";
  const mods = [m.readonly ? "R" : "", m.optional ? "?" : ""].filter(Boolean).join("");
  return `P:${memberKey(m)}:${typeAnn}${mods}`;
}

function serializeMethodSignature(m: TSESTree.TSMethodSignature): string {
  const params = m.params.map(paramToString).join(",");
  const ret = m.returnType ? serializeTypeAnnotation(m.returnType) : "void";
  const mods = [m.readonly ? "R" : "", m.optional ? "?" : ""].filter(Boolean).join("");
  return `M:${memberKey(m)}(${params}):${ret}${mods}`;
}

function serializeCallSignature(m: TSESTree.TSCallSignatureDeclaration): string {
  const params = m.params.map(paramToString).join(",");
  const ret = m.returnType ? serializeTypeAnnotation(m.returnType) : "void";
  return `C(${params}):${ret}`;
}

function serializeConstructSignature(m: TSESTree.TSConstructSignatureDeclaration): string {
  const params = m.params.map(paramToString).join(",");
  const ret = m.returnType ? serializeTypeAnnotation(m.returnType) : "unknown";
  return `N(${params}):${ret}`;
}

function serializeIndexSignature(m: TSESTree.TSIndexSignature): string {
  const params = m.parameters.map(paramToString).join(",");
  const ret = m.typeAnnotation ? serializeTypeAnnotation(m.typeAnnotation) : "unknown";
  return `I(${params}):${ret}`;
}

function serializeMember(m: TSESTree.TypeElement): string {
  if (m.type === "TSPropertySignature") return serializePropertySignature(m);
  if (m.type === "TSMethodSignature") return serializeMethodSignature(m);
  if (m.type === "TSCallSignatureDeclaration") return serializeCallSignature(m);
  if (m.type === "TSConstructSignatureDeclaration") return serializeConstructSignature(m);
  if (m.type === "TSIndexSignature") return serializeIndexSignature(m);
  return `__unknown__`;
}

function canonicalize(node: TSESTree.TSTypeLiteral): string {
  const parts: string[] = [];
  for (const m of node.members) {
    parts.push(serializeMember(m));
  }
  parts.sort((a, b) => a.localeCompare(b));
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
        "Duplicate inline structural type used {{count}} times. Extract this shape into a named interface or type alias. See: {{url}}",
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
                data: { count: String(group.length), url: URL },
              });
            }
          }
        }
      },
    };
  },
});
