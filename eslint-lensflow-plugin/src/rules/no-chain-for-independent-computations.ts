import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T54-functor-applicative-monad.md");

function extractIdentifier(
  param: TSESTree.Parameter | TSESTree.Expression,
): TSESTree.Identifier | null {
  if (param.type === AST_NODE_TYPES.Identifier) return param;
  if (param.type === AST_NODE_TYPES.AssignmentPattern) {
    return extractIdentifier(param.left);
  }
  if (param.type === AST_NODE_TYPES.RestElement) {
    return extractIdentifier(param.argument);
  }
  return null;
}

function unwrapCallee(node: TSESTree.CallExpression): TSESTree.Node {
  if (node.callee.type === AST_NODE_TYPES.ChainExpression) {
    return node.callee.expression;
  }
  return node.callee;
}

export default createRule({
  name: "no-chain-for-independent-computations",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using chain/flatMap for independent computations that don't depend on the previous result. Note: destructured parameters (ObjectPattern, ArrayPattern) are not analyzed—add a valid test case if your callback intentionally destructures its parameter.",
    },
    messages: {
      unusedParamInChain:
        "The callback parameter '{{param}}' is unused in this chain call. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: {{url}}",
      noParamInChain:
        "The chain callback has no parameters. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<"noParamInChain" | "unusedParamInChain", []>,
  ) {
    const chainMethods = new Set(["chain", "flatMap"]);

    function isChainCall(node: TSESTree.CallExpression): boolean {
      const callee = unwrapCallee(node);
      if (callee.type === AST_NODE_TYPES.MemberExpression) {
        const prop = callee.property;

        if (
          prop.type === AST_NODE_TYPES.Identifier &&
          chainMethods.has(prop.name)
        ) {
          return true;
        }
      }

      return false;
    }

    function isChainCallback(
      ctx: TSESLint.RuleContext<"noParamInChain" | "unusedParamInChain", []>,
      callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    ): TSESTree.CallExpression | null {
      const parent = callback.parent;
      if (parent?.type !== AST_NODE_TYPES.CallExpression) return null;
      if (!isChainCall(parent)) return null;
      if (parent.arguments[0] !== callback) return null;
      return parent;
    }

    function checkCallbackParams(
      ctx: TSESLint.RuleContext<"noParamInChain" | "unusedParamInChain", []>,
      callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
    ): void {
      const [firstParam] = callback.params;

      if (!firstParam) {
        ctx.report({
          node: callback,
          messageId: "noParamInChain",
          data: { url: URL },
        });
        return;
      }

      // Skip destructured parameters (ObjectPattern, ArrayPattern) —
      // usage analysis for destructured bindings is not implemented.
      const ident = extractIdentifier(firstParam);
      if (!ident) return;

      const scopeManager = ctx.sourceCode.scopeManager;
      const paramVar = scopeManager
        ?.getDeclaredVariables(callback)
        .find((v) => v.name === ident.name);

      // For AssignmentPattern like (x = 1), the scope manager counts the
      // identifier inside the pattern as a reference. Filter those out so
      // we only count actual usages in the function body.
      const realReferences = paramVar?.references.filter((ref) => {
        const refId = ref.identifier;
        let currentNode: TSESTree.Node | undefined = refId;
        while (currentNode && currentNode !== callback) {
          if (currentNode === firstParam) return false;
          currentNode = (currentNode as any).parent;
        }
        return true;
      });

      if (paramVar && (realReferences?.length || 0) === 0) {
        ctx.report({
          node: callback,
          messageId: "unusedParamInChain",
          data: { param: ident.name, url: URL },
        });
      }
    }

    return {
      ArrowFunctionExpression(callbackArg) {
        if (!isChainCallback(context, callbackArg)) return;
        checkCallbackParams(context, callbackArg);
      },
      FunctionExpression(callbackArg) {
        if (!isChainCallback(context, callbackArg)) return;
        checkCallbackParams(context, callbackArg);
      },
    };
  },
});
