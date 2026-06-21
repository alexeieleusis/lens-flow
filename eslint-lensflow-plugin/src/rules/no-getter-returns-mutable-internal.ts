import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

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
    const typeName = node.typeName;
    let name: string | null = null;
    if (typeName.type === "Identifier") {
      name = typeName.name;
    } else {
      const full = sourceCode.getText(typeName);
      name = full.split(".").pop() || null;
    }
    if (name) {
      if (["Map", "Set", "Array"].includes(name)) {
        return true;
      }
      if (["ReadonlyMap", "ReadonlySet", "ReadonlyArray"].includes(name)) {
        return false;
      }
    }
    return false;
  }

  if (node.type === "TSTypeLiteral") {
    return true;
  }

  if (node.type === "TSUnionType") {
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
        "Getter '{{name}}' returns a mutable type ({{returnType}}). Callers can mutate encapsulated internal state. Return a snapshot (e.g., Array.from(), [...set], new Map()) or a readonly type instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableGetterReturn", []>) {
    return {
      ClassBody(node) {
        const getters = node.body.filter(
          (member): member is TSESTree.MethodDefinition =>
            member.type === "MethodDefinition" && member.kind === "get",
        );

        for (const getter of getters) {
          const returnTypeAnnotation =
            getter.value.returnType?.typeAnnotation;

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
