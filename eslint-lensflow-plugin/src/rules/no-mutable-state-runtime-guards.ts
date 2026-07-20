import { createRule } from "../utils/rule-creator.js";
import { hasThrow, walk } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { TSESTree } from "@typescript-eslint/utils";
import type { TSESLint } from "@typescript-eslint/utils";

const URL = knowledgeUrl("usecases/UC13-state-machines.md");

function isStringLiteralUnion(node: any): node is { types: any[] } {
  return (
    node.type === "TSUnionType" &&
    node.types.every(
      (t: any) =>
        t.type === "TSLiteralType" &&
        t.literal.type === "Literal" &&
        typeof t.literal.value === "string",
    )
  );
}

function getStatePropertyFromBinaryExpr(expr: any, stateProps: string[]): string | null {
  const { left, right } = expr;

  let propName: string | null = null;
  let otherOperand: any = null;

  if (
    left.type === "MemberExpression" &&
    left.object.type === "ThisExpression" &&
    left.property.type === "Identifier" &&
    stateProps.includes(left.property.name)
  ) {
    propName = left.property.name;
    otherOperand = right;
  } else if (
    right.type === "MemberExpression" &&
    right.object.type === "ThisExpression" &&
    right.property.type === "Identifier" &&
    stateProps.includes(right.property.name)
  ) {
    propName = right.property.name;
    otherOperand = left;
  }

  if (
    propName &&
    otherOperand?.type === "Literal" &&
    typeof otherOperand.value === "string"
  ) {
    return propName;
  }

  return null;
}

function collectStateProps(member: any): string | null {
  if (
    member.type === "PropertyDefinition" &&
    !member.readonly &&
    member.typeAnnotation?.typeAnnotation &&
    isStringLiteralUnion(member.typeAnnotation.typeAnnotation) &&
    member.key.type === "Identifier"
  ) {
    return member.key.name;
  }
  return null;
}

function isGuardCandidate(n: any): n is TSESTree.IfStatement {
  if (n.type !== "IfStatement") return false;
  if (n.test.type !== "BinaryExpression") return false;
  const op = n.test.operator;
  return op === "!==" || op === "===" || op === "==" || op === "!=";
}

function recordGuardViolation(
  expr: any,
  consequent: any,
  alternate: any,
  stateProps: string[],
  violations: { stateProp: string; methodName: string }[],
  methodName: string,
): void {
  const matchedProp = getStatePropertyFromBinaryExpr(expr, stateProps);
  if (matchedProp) {
    const consequentThrows = consequent ? hasThrow(consequent) : false;
    const alternateThrows = alternate ? hasThrow(alternate) : false;
    if (consequentThrows || alternateThrows) {
      violations.push({ stateProp: matchedProp, methodName });
    }
  }
}

function walkForGuard(
  root: any,
  stateProps: string[],
  violations: { stateProp: string; methodName: string }[],
  methodName: string,
): void {
  if (!root) return;

  walk(root, (n) => {
    if (isGuardCandidate(n)) {
      recordGuardViolation(n.test, n.consequent, n.alternate, stateProps, violations, methodName);
    }
  });
}

function walkMethodBodies(
  members: any[],
  stateProps: string[],
): { stateProp: string; methodName: string }[] {
  const violations: { stateProp: string; methodName: string }[] = [];

  for (const member of members) {
    if (member.type !== "MethodDefinition" || !member.key?.type || member.key.type !== "Identifier") continue;
    if (!member.value?.body) continue;

    walkForGuard(member.value.body, stateProps, violations, member.key.name);
  }

  return violations;
}

export default createRule({
  name: "no-mutable-state-runtime-guards",
  meta: {
    type: "problem",
    docs: {
      description:
        "Flags classes that use mutable string-literal-union state properties with runtime if/throw guards instead of compile-time typestate enforcement.",
    },
    messages: {
      mutableStateRuntimeGuard:
        "Class uses mutable state property \"{{stateProp}}\" with runtime if/throw guard in method \"{{methodName}}\". Consider using compile-time typestate enforcement instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutableStateRuntimeGuard", []>) {
    return {
      ClassBody(node) {
        const stateProps: string[] = [];

        for (const member of node.body) {
          const propName = collectStateProps(member);
          if (propName) {
            stateProps.push(propName);
          }
        }

        if (stateProps.length === 0) return;

        const violations = walkMethodBodies(node.body, stateProps);

        for (const v of violations) {
          context.report({
            node,
            messageId: "mutableStateRuntimeGuard",
            data: {
              stateProp: v.stateProp,
              methodName: v.methodName,
              url: URL,
            },
          });
        }
      },
    };
  },
});
