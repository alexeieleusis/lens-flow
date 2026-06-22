import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-chain-for-independent-computations",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using chain/flatMap for independent computations that don't depend on the previous result",
    },
    messages: {
      unusedParamInChain:
        "The callback parameter '{{param}}' is unused in this chain call. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T54-functor-applicative-monad.md",
      noParamInChain:
        "The chain callback has no parameters. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T54-functor-applicative-monad.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noParamInChain" | "unusedParamInChain", []>) {
    const chainMethods = new Set(["chain", "flatMap"]);

    function unwrapCallee(node: TSESTree.CallExpression): TSESTree.Node {
      if (node.callee.type === AST_NODE_TYPES.ChainExpression) {
        return node.callee.expression;
      }
      return node.callee;
    }

    function isChainCall(node: TSESTree.CallExpression): boolean {
      const callee = unwrapCallee(node);
      if (callee.type === AST_NODE_TYPES.MemberExpression) {
        const prop = callee.property;

        if (prop.type === AST_NODE_TYPES.Identifier && chainMethods.has(prop.name)) {
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
        });
        return;
      }

      if (firstParam.type !== AST_NODE_TYPES.Identifier) return;

      const scopeManager = ctx.sourceCode.scopeManager;
      const paramVar = scopeManager?.getDeclaredVariables(callback).find(
        (v) => v.name === firstParam.name,
      );

      if (paramVar && paramVar.references.length === 0) {
        ctx.report({
          node: callback,
          messageId: "unusedParamInChain",
          data: { param: firstParam.name },
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
