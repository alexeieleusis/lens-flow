import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function getParamTypeAnnotation(p: TSESTree.Parameter): TSESTree.TypeNode | null {
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

function serializeTypeLiteral(node: TSESTree.TSTypeLiteral): string {
  const members: string[] = [];

  for (const member of node.members) {
    if (member.type === "TSPropertySignature") {
      let keyName = "";
      if (member.key.type === "Identifier") {
        keyName = member.key.name;
      } else if (member.key.type === "Literal") {
        keyName = String(member.key.value);
      }

      let typeStr = "";
      if (member.typeAnnotation?.typeAnnotation) {
        typeStr = serializeType(member.typeAnnotation.typeAnnotation);
      }

      const mods = [member.readonly ? "r" : "", member.optional ? "?" : ""].filter(Boolean).join("");
      members.push(`prop:${keyName}:${typeStr}${mods}`);

    } else if (member.type === "TSMethodSignature") {
      const keyName =
        member.key.type === "Identifier"
          ? member.key.name
          : member.key.type === "Literal"
            ? String(member.key.value)
            : "";
      const returnType = member.returnType?.typeAnnotation
        ? serializeType(member.returnType.typeAnnotation)
        : "";
      const params = (member.params ?? []).map((p) => serializeType(getParamTypeAnnotation(p))).join(",");
      members.push(`method:${keyName}(${params}):${returnType}`);

    } else if (member.type === "TSCallSignatureDeclaration") {
      const returnType = member.returnType?.typeAnnotation
        ? serializeType(member.returnType.typeAnnotation)
        : "";
      const params = member.params.map((p) => serializeType(getParamTypeAnnotation(p))).join(",");
      members.push(`call(${params}):${returnType}`);

    } else if (member.type === "TSConstructSignatureDeclaration") {
      const returnType = member.returnType?.typeAnnotation
        ? serializeType(member.returnType.typeAnnotation)
        : "";
      const params = member.params.map((p) => serializeType(getParamTypeAnnotation(p))).join(",");
      members.push(`new(${params}):${returnType}`);

    } else if (member.type === "TSIndexSignature") {
      const indexType = member.parameters[0]
        ? serializeType(getParamTypeAnnotation(member.parameters[0]))
        : "";
      const typeStr = member.typeAnnotation?.typeAnnotation
        ? serializeType(member.typeAnnotation.typeAnnotation)
        : "";
      members.push(`index[${indexType}]:${typeStr}`);
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
      const ref = node as TSESTree.TSTypeReference;
      const name = ref.typeName.type === "Identifier" ? ref.typeName.name : "complex";
      const tp = (ref as unknown as { typeParameters?: { params: TSESTree.TypeNode[] } })?.typeParameters;
      const params = tp?.params[0]
        ? `[${tp.params.map(serializeType).join(",")}]`
        : "";
      return `ref:${name}${params}`;
    }
    case "TSUnionType":
      return `union:[${node.types.map(serializeType).sort((a, b) => a.localeCompare(b)).join("|")}]`;
    case "TSIntersectionType":
      return `intersection:[${node.types.map(serializeType).sort((a, b) => a.localeCompare(b)).join("&")}]`;
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
            stmt.typeParameters?.params
                ?.map((p) => p.name.name)
                .filter(Boolean) ?? [],
        );

        if (
            ann.checkType.type !== "TSTypeReference" ||
            ann.checkType.typeName.type !== "Identifier" ||
            !typeParamNames.has(ann.checkType.typeName.name)
        ) continue;

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
        "Duplicated inline constraint literal shared by {{count}} type declarations. Extract into a named type alias. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC04-generic-constraints.md",
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
  create(context: TSESLint.RuleContext<"duplicatedConstraint", [{ minDuplicates: number }]>) {
    const [{ minDuplicates } = { minDuplicates: 2 }] =
      context.options ?? [{ minDuplicates: 2 }];

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
                },
              });
            }
          }
        }
      },
    };
  },
});
