import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC06-immutability.md");

const iterationMethods = new Set([
  "map",
  "forEach",
  "filter",
  "reduce",
  "some",
  "every",
  "find",
  "findIndex",
  "flatMap",
]);

function isCallbackExpression(
  node: TSESTree.Node
): node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression"
  );
}

function extractParamNames(
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): string[] {
  return callback.params
    .filter((p): p is TSESTree.Identifier => p.type === "Identifier")
    .map((p) => p.name);
}

function getRootIdentifier(
  node: TSESTree.Node
): TSESTree.Identifier | null {
  while (node.type === "MemberExpression") {
    node = node.object;
  }
  if (node.type === "Identifier") return node;
  return null;
}

function isAssignmentMutation(
  node: TSESTree.Node,
  paramNames: string[]
): node is TSESTree.AssignmentExpression {
  if (
    node.type === "AssignmentExpression" &&
    node.left.type === "MemberExpression"
  ) {
    const root = getRootIdentifier(node.left);
    if (root && paramNames.includes(root.name)) return true;
  }
  return false;
}

function isUpdateMutation(
  node: TSESTree.Node,
  paramNames: string[]
): node is TSESTree.UpdateExpression {
  if (
    node.type === "UpdateExpression" &&
    node.argument.type === "MemberExpression"
  ) {
    const root = getRootIdentifier(node.argument);
    if (root && paramNames.includes(root.name)) return true;
  }
  return false;
}

function findMutations(
  body: TSESTree.Node,
  paramNames: string[]
): (TSESTree.AssignmentExpression | TSESTree.UpdateExpression)[] {
  const mutations: (
    | TSESTree.AssignmentExpression
    | TSESTree.UpdateExpression
  )[] = [];

  walk(body, (n) => {
    if (isAssignmentMutation(n, paramNames) || isUpdateMutation(n, paramNames)) {
      mutations.push(n);
    }
  });

  return mutations;
}

function getPropertyName(prop: TSESTree.Node): string {
  if (prop.type === "Identifier") return prop.name;
  if (prop.type === "Literal") return String(prop.value);
  return "?";
}

function getParamNameFromMemberExpression(
  member: TSESTree.MemberExpression
): string {
  const root = getRootIdentifier(member);
  return root ? root.name : "?";
}

function buildPropertyPath(member: TSESTree.MemberExpression): string {
  const parts: string[] = [];
  let current: TSESTree.Node = member;
  while (current.type === "MemberExpression") {
    parts.unshift(getPropertyName(current.property));
    current = current.object;
  }
  return parts.join(".");
}

function extractMutationInfo(
  mutation: TSESTree.AssignmentExpression | TSESTree.UpdateExpression
): { propName: string; paramName: string } {
  if (
    mutation.type === "AssignmentExpression" &&
    mutation.left.type === "MemberExpression"
  ) {
    return {
      propName: buildPropertyPath(mutation.left),
      paramName: getParamNameFromMemberExpression(mutation.left),
    };
  }

  if (
    mutation.type === "UpdateExpression" &&
    mutation.argument.type === "MemberExpression"
  ) {
    return {
      propName: buildPropertyPath(mutation.argument),
      paramName: getParamNameFromMemberExpression(mutation.argument),
    };
  }

  return { propName: "?", paramName: "?" };
}

function reportMutations(
  context: Parameters<NonNullable<ReturnType<typeof createRule>["create"]>>[0],
  mutations: (TSESTree.AssignmentExpression | TSESTree.UpdateExpression)[]
) {
  for (const mutation of mutations) {
    const { propName, paramName } = extractMutationInfo(mutation);

     context.report({
        node: mutation,
        messageId: "mutateCallbackArg",
        data: { param: paramName, prop: propName, url: URL },
      });
  }
}

export default createRule({
  name: "no-mutate-iteration-callback-argument",
  meta: {
    type: "problem",
    fixable: undefined,
    docs: {
      description:
        "Disallow mutating properties of the callback parameter inside array iteration methods",
    },
    messages: {
      mutateCallbackArg:
        "Mutating {{prop}} on the iteration callback parameter '{{param}}'. Return a new object instead of mutating the original. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutateCallbackArg", []>) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression") return;

        const methodName =
          callee.property.type === "Identifier" ? callee.property.name : null;
        if (!methodName || !iterationMethods.has(methodName)) return;

        const callback = node.arguments[0];
        if (!isCallbackExpression(callback)) return;

        const paramNames = extractParamNames(callback);
        if (paramNames.length === 0) return;

        const mutations = findMutations(callback.body, paramNames);
        reportMutations(context, mutations);
      },
    };
  },
});
