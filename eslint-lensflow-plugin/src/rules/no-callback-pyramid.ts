import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC21-async-concurrency.md");

const isCallback = (node: TSESTree.Node): boolean =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionExpression";

const isCallbackCall = (node: TSESTree.Node): node is TSESTree.CallExpression =>
  node.type === "CallExpression" &&
  "arguments" in node &&
  Array.isArray(node.arguments) &&
  node.arguments.length > 0 &&
  isCallback(
    node.arguments[
      node.arguments.length - 1
    ],
  );

const getCallbackBody = (node: TSESTree.CallExpression): TSESTree.Node[] => {
  const lastArg = node.arguments[node.arguments.length - 1];
  if (lastArg.type === "ArrowFunctionExpression") {
    if (lastArg.body.type === "BlockStatement") {
      return lastArg.body.body;
    }
    return [lastArg.body];
  }
  if (lastArg.type === "FunctionExpression" && lastArg.body) {
    return lastArg.body.body;
  }
  return [];
};

const processIfBranch = (
  branch: TSESTree.Node | null | undefined,
  depth: number,
  currentMax: number,
): number => {
  if (!branch) return currentMax;
  if (branch.type === "BlockStatement") {
    return Math.max(currentMax, findNestedCallbackCalls(branch.body, depth));
  }
  return Math.max(currentMax, findNestedCallbackCalls([branch], depth));
};

const processIfStatement = (
  node: TSESTree.IfStatement,
  depth: number,
): number => {
  let maxDepth = findNestedCallbackCalls([node.test], depth);
  maxDepth = processIfBranch(node.consequent, depth, maxDepth);
  maxDepth = processIfBranch(node.alternate, depth, maxDepth);
  return maxDepth;
};

const processChildProperties = (
  node: TSESTree.Node,
  depth: number,
): number => {
  let maxDepth = depth;
  for (const child of getChildren(node)) {
    maxDepth = Math.max(maxDepth, findNestedCallbackCalls([child], depth));
  }
  return maxDepth;
};

const findNestedCallbackCalls = (
  nodes: TSESTree.Node[],
  depth: number,
): number => {
  let maxDepth = depth;

  for (const node of nodes) {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      continue;
    }

    if (node.type === "BlockStatement") {
      maxDepth = Math.max(maxDepth, findNestedCallbackCalls(node.body, depth));
      continue;
    }

    if (node.type === "IfStatement") {
      maxDepth = Math.max(maxDepth, processIfStatement(node, depth));
      continue;
    }

    if (isCallbackCall(node)) {
      const bodyNodes = getCallbackBody(node);
      maxDepth = Math.max(maxDepth, findNestedCallbackCalls(bodyNodes, depth + 1));
    } else if (
      node.type === "ExpressionStatement" &&
      isCallbackCall(node.expression)
    ) {
      const bodyNodes = getCallbackBody(node.expression);
      maxDepth = Math.max(
        maxDepth,
        findNestedCallbackCalls(bodyNodes, depth + 1),
      );
    } else {
      maxDepth = Math.max(maxDepth, processChildProperties(node, depth));
    }
  }

  return maxDepth;
};

interface CallbackCall {
  node: TSESTree.CallExpression;
  depth: number;
  start: number;
  end: number;
}

export default createRule({
  name: "no-callback-pyramid",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow deeply nested callback pyramid patterns that should use async/await with Promise.all",
    },
    messages: {
      callbackPyramid:
        "Found {{depth}} levels of nested callbacks. Refactor using async/await and Promise.all instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minDepth: {
            type: "number",
            minimum: 2,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ minDepth: 3 }],
  create(context: TSESLint.RuleContext<"callbackPyramid", [{ minDepth: number }]>) {
    const [{ minDepth = 3 } = {}] = context.options;

    const callbackCalls: CallbackCall[] = [];

    return {
      CallExpression(node) {
        if (
          node.arguments.length > 0 &&
          isCallback(node.arguments[node.arguments.length - 1])
        ) {
          const bodyNodes = getCallbackBody(node);
          const maxDepth = findNestedCallbackCalls(bodyNodes, 1);
          callbackCalls.push({
            node,
            depth: maxDepth,
            start: node.range[0],
            end: node.range[1],
          });
        }
      },
      "Program:exit"() {
        const toReport = new Set<CallbackCall>();

        for (const cc of callbackCalls) {
          if (cc.depth < minDepth) continue;

          let isInsideOther = false;
          for (const other of callbackCalls) {
            if (other === cc) continue;
            if (other.start < cc.start && other.end > cc.end) {
              isInsideOther = true;
              break;
            }
          }

          if (!isInsideOther) {
            toReport.add(cc);
          }
        }

        for (const cc of toReport) {
          context.report({
            node: cc.node,
            messageId: "callbackPyramid",
            data: {
              depth: String(cc.depth),
              url: URL,
            },
          });
        }
      },
    };
  },
});
