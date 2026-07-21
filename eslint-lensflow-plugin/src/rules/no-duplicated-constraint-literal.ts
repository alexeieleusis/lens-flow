import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC04-generic-constraints.md");

function getParamTypeAnnotation(
  p: TSESTree.Parameter,
): TSESTree.TypeNode | null {
  if (
    p.type === "Identifier" ||
    p.type === "ArrayPattern" ||
    p.type === "ObjectPattern" ||
    p.type === "AssignmentPattern" ||
    p.type === "RestElement"
  ) {
    return p.typeAnnotation?.typeAnnotation ?? null;
  }
  return null;
}

function extractKeyName(key: TSESTree.PropertyName): string {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal") return String(key.value);
  return "";
}

function serializeParamList(params: TSESTree.Parameter[]): string {
  return params.map((p) => serializeType(getParamTypeAnnotation(p))).join(",");
}

function serializeReturnType(node: {
  returnType?: { typeAnnotation?: TSESTree.TypeNode };
}): string {
  return node.returnType?.typeAnnotation
    ? serializeType(node.returnType.typeAnnotation)
    : "";
}

function serializePropertySignature(
  member: TSESTree.TSPropertySignature,
): string {
  const keyName = extractKeyName(member.key);
  const typeStr = member.typeAnnotation?.typeAnnotation
    ? serializeType(member.typeAnnotation.typeAnnotation)
    : "";
  const mods = [member.readonly ? "r" : "", member.optional ? "?" : ""]
    .filter(Boolean)
    .join("");
  return `prop:${keyName}:${typeStr}${mods}`;
}

function serializeMethodSignature(member: TSESTree.TSMethodSignature): string {
  const keyName = extractKeyName(member.key);
  const returnType = serializeReturnType(member);
  const params = serializeParamList(member.params ?? []);
  return `method:${keyName}(${params}):${returnType}`;
}

function serializeCallSignature(
  member: TSESTree.TSCallSignatureDeclaration,
): string {
  const returnType = serializeReturnType(member);
  const params = serializeParamList(member.params);
  return `call(${params}):${returnType}`;
}

function serializeConstructSignature(
  member: TSESTree.TSConstructSignatureDeclaration,
): string {
  const returnType = serializeReturnType(member);
  const params = serializeParamList(member.params);
  return `new(${params}):${returnType}`;
}

function serializeIndexSignature(member: TSESTree.TSIndexSignature): string {
  const indexType = member.parameters[0]
    ? serializeType(getParamTypeAnnotation(member.parameters[0]))
    : "";
  const typeStr = member.typeAnnotation?.typeAnnotation
    ? serializeType(member.typeAnnotation.typeAnnotation)
    : "";
  return `index[${indexType}]:${typeStr}`;
}

function serializeTypeLiteral(node: TSESTree.TSTypeLiteral): string {
  const members: string[] = [];

  for (const member of node.members) {
    if (member.type === "TSPropertySignature") {
      members.push(serializePropertySignature(member));
    } else if (member.type === "TSMethodSignature") {
      members.push(serializeMethodSignature(member));
    } else if (member.type === "TSCallSignatureDeclaration") {
      members.push(serializeCallSignature(member));
    } else if (member.type === "TSConstructSignatureDeclaration") {
      members.push(serializeConstructSignature(member));
    } else if (member.type === "TSIndexSignature") {
      members.push(serializeIndexSignature(member));
    }
  }

  members.sort((a, b) => a.localeCompare(b));
  return members.join(",");
}

function serializeType(node: TSESTree.TypeNode | null): string {
  if (!node) return "any";
  switch (node.type) {
    case "TSBooleanKeyword":
      return "boolean";
    case "TSStringKeyword":
      return "string";
    case "TSNumberKeyword":
      return "number";
    case "TSNullKeyword":
      return "null";
    case "TSUndefinedKeyword":
      return "undefined";
    case "TSAnyKeyword":
      return "any";
    case "TSUnknownKeyword":
      return "unknown";
    case "TSNeverKeyword":
      return "never";
    case "TSVoidKeyword":
      return "void";
    case "TSLiteralType":
      return `literal:${JSON.stringify(node.literal)}`;
    case "TSTypeReference": {
      const name =
        node.typeName.type === "Identifier" ? node.typeName.name : "complex";
      const tp = (
        node as unknown as { typeParameters?: { params: TSESTree.TypeNode[] } }
      )?.typeParameters;
      const params = tp?.params[0]
        ? `[${tp.params.map(serializeType).join(",")}]`
        : "";
      return `ref:${name}${params}`;
    }
    case "TSUnionType":
      return `union:[${node.types
        .map(serializeType)
        .sort((a, b) => a.localeCompare(b))
        .join("|")}]`;
    case "TSIntersectionType":
      return `intersection:[${node.types
        .map(serializeType)
        .sort((a, b) => a.localeCompare(b))
        .join("&")}]`;
    case "TSArrayType":
      return `array:${serializeType(node.elementType)}`;
    case "TSConditionalType":
      return `conditional:${serializeType(node.checkType)}:${serializeType(node.extendsType)}:${serializeType(node.trueType)}:${serializeType(node.falseType)}`;
    case "TSTypeLiteral":
      return `literal:${serializeTypeLiteral(node)}`;
    case "TSTypeQuery":
      return "typeof";
    case "TSIndexedAccessType":
      return `indexed:${serializeType(node.objectType)}[${serializeType(node.indexType)}]`;
    case "TSMappedType":
      return "mapped";
    default:
      return node.type;
  }
}

function collectConditionals(
  scope: TSESTree.Program["body"],
): { conditional: TSESTree.TSConditionalType; key: string }[] {
  const result: { conditional: TSESTree.TSConditionalType; key: string }[] = [];

  for (const stmt of scope) {
    if (stmt.type !== "TSTypeAliasDeclaration") continue;

    const ann = stmt.typeAnnotation;
    if (ann?.type !== "TSConditionalType") continue;

    const typeParamNames = new Set(
      stmt.typeParameters?.params?.map((p) => p.name.name).filter(Boolean) ??
        [],
    );

    if (
      ann.checkType.type !== "TSTypeReference" ||
      ann.checkType.typeName.type !== "Identifier" ||
      !typeParamNames.has(ann.checkType.typeName.name)
    )
      continue;

    let extendsType: TSESTree.TypeNode = ann.extendsType;
    if (extendsType.type !== "TSTypeLiteral") continue;

    const key = serializeTypeLiteral(extendsType);
    result.push({ conditional: ann, key });
  }

  return result;
}

export default createRule({
  name: "no-duplicated-constraint-literal",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow multiple conditional types that duplicate the same inline constraint literal instead of sharing a named type alias",
    },
    messages: {
      duplicatedConstraint:
        "Duplicated inline constraint literal shared by {{count}} type declarations. Extract into a named type alias. See: {{url}}",
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
  defaultOptions: [{ minDuplicates: 2 }],
  create(
    context: TSESLint.RuleContext<
      "duplicatedConstraint",
      [{ minDuplicates: number }]
    >,
  ) {
    const [{ minDuplicates } = { minDuplicates: 2 }] = context.options ?? [
      { minDuplicates: 2 },
    ];

    return {
      "Program:exit"() {
        const conditionals = collectConditionals(context.sourceCode.ast.body);

        const groups = new Map<string, TSESTree.TSConditionalType[]>();

        for (const { conditional, key } of conditionals) {
          const group = groups.get(key) || [];
          group.push(conditional);
          groups.set(key, group);
        }

        for (const [, group] of groups) {
          if (group.length >= minDuplicates) {
            for (const conditional of group) {
              context.report({
                node: conditional,
                messageId: "duplicatedConstraint",
                data: {
                  count: String(group.length),
                  url: URL,
                },
              });
            }
          }
        }
      },
    };
  },
});
