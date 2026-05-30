import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const SKIP_KEYS = new Set([
  "parent",
  "loc",
  "range",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "typeAnnotations",
]);

function isASTNode(val: unknown): val is TSESTree.Node {
  return val != null && typeof val === "object" && "type" in val;
}

function getTraversableKeys(node: TSESTree.Node): (keyof TSESTree.Node)[] {
  return Object.keys(node)
    .filter((key) => !SKIP_KEYS.has(key))
    .map((key) => key as keyof TSESTree.Node);
}

function isParameterUsed(paramName: string, body: TSESTree.Node): boolean {
  let used = false;

  function walk(node: TSESTree.Node | undefined): void {
    if (used || !node) return;

    if (node.type === AST_NODE_TYPES.Identifier && node.name === paramName) {
      used = true;
      return;
    }

    for (const key of getTraversableKeys(node)) {
      const val = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (isASTNode(item)) {
            walk(item);
          }
        }
      } else if (isASTNode(val)) {
        walk(val);
      }
    }
  }

  if ("body" in body && body.body) {
    if (Array.isArray(body.body)) {
      for (const stmt of body.body) {
        walk(stmt);
      }
    } else {
      walk(body.body);
    }
  }

  return used;
}

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
        "The callback parameter '{{param}}' is unused in this chain call. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T54-functor-applicative-monad.md",
      noParamInChain:
        "The chain callback has no parameters. The computation is independent and will be short-circuited if a prior step fails. Use applicative style (ap, sequenceS) for independent validations. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T54-functor-applicative-monad.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noParamInChain" | "unusedParamInChain", []>) {
    const chainMethods = new Set(["chain", "flatMap"]);

    function isChainCall(node: TSESTree.CallExpression): boolean {
      if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
        const callee = node.callee as TSESTree.MemberExpression;
        const prop = callee.property;

        if (prop.type === AST_NODE_TYPES.Identifier && chainMethods.has(prop.name)) {
          return true;
        }
      }

      return false;
    }

    return {
      CallExpression(node) {
        if (!isChainCall(node)) return;

        const [callbackArg] = node.arguments;
        if (!callbackArg) return;

        const isFunction =
          callbackArg.type === AST_NODE_TYPES.ArrowFunctionExpression ||
          callbackArg.type === AST_NODE_TYPES.FunctionExpression;
        if (!isFunction) return;

        const [firstParam] = callbackArg.params;

        if (!firstParam) {
          context.report({
            node,
            messageId: "noParamInChain",
          });
          return;
        }

        if (firstParam.type === AST_NODE_TYPES.Identifier) {
          const paramName = firstParam.name;
          const isUsed = isParameterUsed(paramName, callbackArg);
          if (!isUsed) {
            context.report({
              node,
              messageId: "unusedParamInChain",
              data: { param: paramName },
            });
          }
        }
      },
    };
  },
});
