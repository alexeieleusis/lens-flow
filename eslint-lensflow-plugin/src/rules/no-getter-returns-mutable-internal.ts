import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const MUTABLE_COLLECTIONS = new Set(["Map", "Set", "Array"]);
const READONLY_COLLECTIONS = new Set(["ReadonlyMap", "ReadonlySet", "ReadonlyArray"]);

function resolveTypeName(
  typeName: TSESTree.TypeName,
  sourceCode: TSESLint.SourceCode,
): string | null {
  if (typeName.type === "Identifier") {
    return typeName.name;
  }
  const full = sourceCode.getText(typeName);
  return full.split(".").pop() || null;
}

function isKnownMutableByName(name: string): boolean {
  if (MUTABLE_COLLECTIONS.has(name)) return true;
  if (READONLY_COLLECTIONS.has(name)) return false;
  return false;
}

function isMutableType(
  node: TSESTree.TypeNode,
  sourceCode: TSESLint.SourceCode,
): boolean {
  if (node.type === "TSTypeOperator" && node.operator === "readonly") {
    return false;
  }

  if (node.type === "TSArrayType") {
    return true;
  }

  if (node.type === "TSTypeReference") {
    const name = resolveTypeName(node.typeName, sourceCode);
    if (name && isKnownMutableByName(name)) {
      return true;
    }
    return false;
  }

  if (node.type === "TSTypeLiteral") {
    return true;
  }

  if (node.type === "TSUnionType") {
    return node.types.some((member) => isMutableType(member, sourceCode));
  }

  if (node.type === "TSIntersectionType") {
    return node.types.some((member) => isMutableType(member, sourceCode));
  }

  return false;
}

export default createRule({
  name: "no-getter-returns-mutable-internal",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow class getters from returning internal mutable collections directly",
    },
    messages: {
      mutableGetterReturn:
        "Getter '{{name}}' returns a mutable type ({{returnType}}). Callers can mutate encapsulated internal state. Return a snapshot (e.g., Array.from(), [...set], new Map()) or a readonly type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableGetterReturn", []>) {
    return {
      ClassBody(node) {
        const getters = node.body.filter(
          (member): member is TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition =>
            (member.type === "MethodDefinition" || member.type === "TSAbstractMethodDefinition") && member.kind === "get",
        );

        for (const getter of getters) {
          const returnTypeAnnotation = getter.value.returnType?.typeAnnotation;

          if (
            returnTypeAnnotation &&
            isMutableType(returnTypeAnnotation, context.sourceCode)
          ) {
            const getterName =
              getter.key.type === "Identifier" ? getter.key.name : "?";
            const returnType = context.sourceCode.getText(returnTypeAnnotation);

            context.report({
              node: getter,
              messageId: "mutableGetterReturn",
              data: {
                name: getterName,
                returnType,
              },
            });
          }
        }
      },
    };
  },
});
