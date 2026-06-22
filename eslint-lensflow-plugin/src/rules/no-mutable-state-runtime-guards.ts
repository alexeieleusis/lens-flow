import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

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

function hasThrowStatement(node: any): boolean {
  if (node.type === "ThrowStatement") return true;
  if (node.type === "BlockStatement") {
    return node.body.some((child: any) => hasThrowStatement(child));
  }
  return false;
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

function isGuardCandidate(n: any): boolean {
  if (n.type !== "IfStatement") return false;
  if (n.test.type !== "BinaryExpression") return false;
  const op = n.test.operator;
  return op === "!==" || op === "===" || op === "==" || op === "!=";
}

function recordGuardViolation(
  expr: any,
  consequent: any,
  stateProps: string[],
  violations: { stateProp: string; methodName: string }[],
  methodName: string,
): void {
  const matchedProp = getStatePropertyFromBinaryExpr(expr, stateProps);
  if (matchedProp && hasThrowStatement(consequent)) {
    violations.push({ stateProp: matchedProp, methodName });
  }
}

function walkForGuard(
  n: any,
  stateProps: string[],
  violations: { stateProp: string; methodName: string }[],
  methodName: string,
): void {
  if (!n || typeof n !== "object") return;

  if (isGuardCandidate(n)) {
    recordGuardViolation(n.test, n.consequent, stateProps, violations, methodName);
  }

  for (const key of Object.keys(n)) {
    if (key === "parent" || key === "range" || key === "loc") continue;
    const child = n[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        walkForGuard(item, stateProps, violations, methodName);
      }
    } else if (child && typeof child === "object" && child.type) {
      walkForGuard(child, stateProps, violations, methodName);
    }
  }
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
        "Class uses mutable state property \"{{stateProp}}\" with runtime if/throw guard in method \"{{methodName}}\". Consider using compile-time typestate enforcement instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC13-state-machines.md",
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
            },
          });
        }
      },
    };
  },
});
