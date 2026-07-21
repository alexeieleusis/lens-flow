import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { collectChildTypes } from "../utils/ts-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOC_URL = knowledgeUrl("catalog/T49-associated-types.md");

function hasInfer(node: TSESTree.TypeNode): boolean {
  if (node.type === "TSInferType") return true;
  const children = collectChildTypes(node);
  return children.some((child) => hasInfer(child));
}

function findReferencedTypeParamNames(node: TSESTree.TypeNode): string[] {
  const names = new Set<string>();

  function walk(type: TSESTree.TypeNode) {
    if (type.type === "TSTypeReference") {
      if (type.typeName.type === "Identifier") {
        names.add(type.typeName.name);
      } else if (type.typeName.type === "TSQualifiedName") {
        names.add(type.typeName.right.name);
      }
    }
    for (const child of collectChildTypes(type)) {
      walk(child);
    }
  }

  walk(node);
  return [...names];
}

function findParentTypeAliasDeclaration(
  ancestors: TSESTree.Node[],
): TSESTree.TSTypeAliasDeclaration | null {
  for (const ancestor of ancestors) {
    if (ancestor.type === "TSTypeAliasDeclaration") return ancestor;
  }
  return null;
}

function isUnconstrained(tp: TSESTree.TSTypeParameter): boolean {
  // If there's no extends clause, the constraint is implicitly unknown
  if (!tp.constraint) return true;

  // If the explicit constraint is `unknown` or `any`, still unconstrained
  if (
    tp.constraint.type === "TSUnknownKeyword" ||
    tp.constraint.type === "TSAnyKeyword"
  ) {
    return true;
  }

  // Has a meaningful constraint
  return false;
}

export default createRule({
  name: "no-silent-never-infer-fallback",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow conditional types with `infer` that fall back to `never` on non-match when the type parameter is unconstrained",
    },
    messages: {
      silentNeverInferFallback:
        "Conditional type with `infer` falls back to `never` on non-match, silently producing `never` instead of surfacing a type error. Constrain the type parameter (e.g., `T extends unknown[]`) so non-matching usage is a compile error. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"silentNeverInferFallback", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    if (!parserServices.program) return {};

    return {
      TSConditionalType(node) {
        const { checkType, extendsType, falseType } = node;

        // Must have `infer` in the extends pattern (the right side of `extends`)
        if (!hasInfer(extendsType)) return;

        // Must fall back to `never` in the false branch
        if (falseType.type !== "TSNeverKeyword") return;

        // Find the enclosing type alias and its type parameters
        const ancestors = context.sourceCode.getAncestors(node);
        const typeAlias = findParentTypeAliasDeclaration(ancestors);
        if (!typeAlias?.typeParameters) return;

        const scopeParamNames = new Set(
          typeAlias.typeParameters.params.map((p) => p.name.name),
        );

        // Find which type parameter names from this scope are referenced in the check type
        const referencedNames = findReferencedTypeParamNames(checkType);

        // Check each referenced type parameter from our scope
        for (const name of referencedNames) {
          if (!scopeParamNames.has(name)) continue;

          const tpNode = typeAlias.typeParameters.params.find(
            (p) => p.name.name === name,
          );
          if (!tpNode) continue;

          if (isUnconstrained(tpNode)) {
            context.report({
              node,
              messageId: "silentNeverInferFallback",
              data: { url: DOC_URL },
            });
          }
        }
      },
    };
  },
});
