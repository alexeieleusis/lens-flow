import { AST_NODE_TYPES, TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KB_URL =
  "See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC14-extensibility.md";

function hasAnyParam(params: readonly unknown[]): boolean {
  return params.some(
    (p: any) =>
      p.typeAnnotation?.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword,
  );
}

function hasAnyReturn(node: { returnType?: { typeAnnotation?: { type?: string } } }): boolean {
  return node.returnType?.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword;
}

function checkMemberForAny(
  member: unknown,
): { targetNode: unknown; anyParam: boolean; anyReturn: boolean } | null {
  const m = member as any;
  if (m.type === AST_NODE_TYPES.TSMethodSignature) {
    return {
      targetNode: m,
      anyParam: hasAnyParam(m.params),
      anyReturn: hasAnyReturn(m),
    };
  }
  if (
    m.type === AST_NODE_TYPES.TSPropertySignature &&
    m.typeAnnotation?.typeAnnotation?.type === AST_NODE_TYPES.TSFunctionType
  ) {
    const fnType = m.typeAnnotation.typeAnnotation;
    return {
      targetNode: m,
      anyParam: hasAnyParam(fnType.params),
      anyReturn: hasAnyReturn(fnType),
    };
  }
  return null;
}

function selectMessageId(anyParam: boolean, anyReturn: boolean): "anyParamAndReturn" | "anyParam" | "anyReturn" {
  if (anyParam && anyReturn) return "anyParamAndReturn";
  if (anyParam) return "anyParam";
  return "anyReturn";
}

export default createRule({
  name: "no-any-in-plugin-context-uc14",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows 'any' as parameter or return type in interface methods and function-typed properties, which defeats structural typing at extension points.",
    },
    messages: {
      anyParam: `Do not use 'any' as a parameter type in interface methods or function-typed properties. Use a specific type to preserve structural typing and type safety at extension points. ${KB_URL}`,
      anyReturn: `Do not use 'any' as a return type in interface methods or function-typed properties. Use a specific return type to preserve type safety at extension points. ${KB_URL}`,
      anyParamAndReturn: `Do not use 'any' as parameter or return type in interface methods or function-typed properties. Use specific types to preserve structural typing and type safety at extension points. ${KB_URL}`,
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn" | "anyParamAndReturn", []>) {
    return {
      TSInterfaceBody(node) {
        for (const member of node.body) {
          const result = checkMemberForAny(member);
          if (!result || (!result.anyParam && !result.anyReturn)) continue;

          context.report({
            node: result.targetNode as TSESTree.Node,
            messageId: selectMessageId(result.anyParam, result.anyReturn),
          });
        }
      },
    };
  },
});
