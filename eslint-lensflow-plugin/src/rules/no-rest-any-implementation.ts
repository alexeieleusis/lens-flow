import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const RULE_DOCS_URL = knowledgeUrl("catalog/T22-callable-typing.md");

type FnLikeNode = TSESTree.FunctionDeclaration | TSESTree.TSDeclareFunction;

function isImplementation(node: FnLikeNode): boolean {
  return node.type === "FunctionDeclaration" && node.body !== null;
}

function getFnName(node: FnLikeNode): string | null {
  return node.id?.type === "Identifier" ? node.id.name : null;
}

function isAnyArrayType(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSArrayType") {
    return node.elementType.type === "TSAnyKeyword";
  }

  if (node.type === "TSTypeReference") {
    const typeName = node.typeName;
    if (
      typeName.type === "Identifier" &&
      (typeName.name === "Array" || typeName.name === "ReadonlyArray") &&
      node.typeArguments &&
      node.typeArguments.params.length > 0 &&
      node.typeArguments.params[0].type === "TSAnyKeyword"
    ) {
      return true;
    }
  }

  return false;
}

function hasRestAnyParameter(params: TSESTree.Parameter[]): boolean {
  if (params.length === 0) return false;

  const lastParam = params[params.length - 1];
  if (lastParam.type !== "RestElement") return false;

  const typeAnn = lastParam.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return false;

  if (typeAnn.type === "TSArrayType") {
    return isAnyArrayType(typeAnn);
  }

  if (typeAnn.type === "TSTypeReference") {
    return isAnyArrayType(typeAnn);
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
        "Disallow using `...args: any[]`, `Array<any>`, or `ReadonlyArray<any>` as the implementation signature for an overloaded function, which erases all type safety from the declared overloads.",
    },
    messages: {
      restAnyImplementation:
        "Overloaded function `{{fnName}}` uses `...args: any[]` (or equivalent `Array<any>` / `ReadonlyArray<any>`) as its implementation rest parameter, erasing all type safety from the declared overloads. Use a typed rest parameter that matches the overload union. See: {{url}}",
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
        const byName = new Map<string, FnLikeNode[]>();
        for (const fn of allFns) {
          const name = getFnName(fn);
          if (!name) continue;
          byName.set(name, [...(byName.get(name) || []), fn]);
        }

        for (const [name, group] of byName) {
          if (group.length >= 2) {
            const impl = group.find(isImplementation);
            if (
              impl?.type === "FunctionDeclaration" &&
              hasRestAnyParameter(impl.params)
            ) {
              context.report({
                node: impl,
                messageId: "restAnyImplementation",
                data: { fnName: name, url: RULE_DOCS_URL },
              });
            }
          }
        }
      },
    };
  },
});
