import { AST_NODE_TYPES, TSESLint } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC14-extensibility.md");

function hasParamTypeAnnotation(
  p: TSESTree.Parameter,
): p is TSESTree.Parameter & { typeAnnotation: TSESTree.TSTypeAnnotation } {
  return "typeAnnotation" in p && p.typeAnnotation !== undefined;
}

function hasAnyParam(params: readonly TSESTree.Parameter[]): boolean {
  return params.some(
    (p) =>
      hasParamTypeAnnotation(p) &&
      p.typeAnnotation.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword,
  );
}

function hasAnyReturn(node: {
  returnType?: { typeAnnotation?: { type?: string } };
}): boolean {
  return node.returnType?.typeAnnotation?.type === AST_NODE_TYPES.TSAnyKeyword;
}

function checkMemberForAny(member: TSESTree.TypeElement): {
  targetNode: TSESTree.TypeElement;
  anyParam: boolean;
  anyReturn: boolean;
} | null {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    return {
      targetNode: member,
      anyParam: hasAnyParam(member.params),
      anyReturn: hasAnyReturn(member),
    };
  }
  if (
    member.type === AST_NODE_TYPES.TSPropertySignature &&
    member.typeAnnotation?.typeAnnotation?.type ===
      AST_NODE_TYPES.TSFunctionType
  ) {
    const fnType = member.typeAnnotation.typeAnnotation;
    return {
      targetNode: member,
      anyParam: hasAnyParam(fnType.params),
      anyReturn: hasAnyReturn(fnType),
    };
  }
  return null;
}

function selectMessageId(
  anyParam: boolean,
  anyReturn: boolean,
): "anyParamAndReturn" | "anyParam" | "anyReturn" {
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
      anyParam:
        "Do not use 'any' as a parameter type in interface methods or function-typed properties. Use a specific type to preserve structural typing and type safety at extension points. See: {{url}}",
      anyReturn:
        "Do not use 'any' as a return type in interface methods or function-typed properties. Use a specific return type to preserve type safety at extension points. See: {{url}}",
      anyParamAndReturn:
        "Do not use 'any' as parameter or return type in interface methods or function-typed properties. Use specific types to preserve structural typing and type safety at extension points. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "anyParam" | "anyReturn" | "anyParamAndReturn",
      []
    >,
  ) {
    return {
      TSInterfaceBody(node) {
        for (const member of node.body) {
          const result = checkMemberForAny(member);
          if (!result || (!result.anyParam && !result.anyReturn)) continue;

          context.report({
            node: result.targetNode,
            messageId: selectMessageId(result.anyParam, result.anyReturn),
            data: { url: URL },
          });
        }
      },
    };
  },
});
