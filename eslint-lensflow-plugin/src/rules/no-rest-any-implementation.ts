import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T22-callable-typing.md";

type FnLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.TSDeclareFunction;

function isImplementation(node: FnLikeNode): boolean {
  return node.type === "FunctionDeclaration" && node.body !== null;
}

function getFnName(node: FnLikeNode): string | null {
  return node.id?.type === "Identifier" ? node.id.name : null;
}

function hasRestAnyParameter(params: TSESTree.Parameter[]): boolean {
  if (params.length === 0) return false;

  const lastParam = params[params.length - 1];
  if (lastParam.type !== "RestElement") return false;

  const typeAnn = lastParam.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return false;

  if (typeAnn.type === "TSArrayType") {
    return typeAnn.elementType.type === "TSAnyKeyword";
  }

  if (typeAnn.type === "TSTupleType") {
    return typeAnn.elementTypes.some((el) => {
      if (el.type === "TSAnyKeyword") return true;
      if (
        el.type === "TSOptionalType" &&
        el.typeAnnotation.type === "TSAnyKeyword"
      )
        return true;
      if (
        el.type === "TSNamedTupleMember" &&
        el.elementType.type === "TSAnyKeyword"
      )
        return true;
      return false;
    });
  }

  return false;
}

export default createRule({
  name: "no-rest-any-implementation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using `...args: any[]` as the implementation signature for an overloaded function, which erases all type safety from the declared overloads.",
    },
    messages: {
      restAnyImplementation:
        "Overloaded function `{{fnName}}` uses `...args: any[]` as its implementation rest parameter, erasing all type safety from the declared overloads. Use a typed rest parameter that matches the overload union. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"restAnyImplementation", []>) {
    const allFns: FnLikeNode[] = [];

    return {
      FunctionDeclaration(node) {
        allFns.push(node);
      },
      TSDeclareFunction(node) {
        allFns.push(node);
      },
      "Program:exit"() {
        let i = 0;
        while (i < allFns.length) {
          const name = getFnName(allFns[i]);

          if (!name) {
            i++;
            continue;
          }

          let j = i + 1;
          while (
            j < allFns.length &&
            allFns[j].id?.type === "Identifier" &&
            allFns[j].id!.name === name
          ) {
            j++;
          }

          const group = allFns.slice(i, j);

          if (group.length >= 2) {
            const impl = group.find(isImplementation);
            if (
              impl?.type === "FunctionDeclaration" &&
              hasRestAnyParameter(impl.params)
            ) {
              context.report({
                node: impl,
                messageId: "restAnyImplementation",
                data: { fnName: name, url: URL },
              });
            }
          }

          i = j;
        }
      },
    };
  },
});
