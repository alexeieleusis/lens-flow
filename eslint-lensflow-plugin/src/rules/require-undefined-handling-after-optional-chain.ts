import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

function typeIncludesUndefined(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Undefined) !== 0) return true;
  if ((type.flags & ts.TypeFlags.Unknown) !== 0) return true;
  if ((type.flags & ts.TypeFlags.Any) !== 0) return false;
  if (type.isUnion()) {
    return type.types.some(typeIncludesUndefined);
  }
  return false;
}

function hasOptionalAccess(node: TSESTree.Node): boolean {
  if (node.type === "MemberExpression" && (node as TSESTree.MemberExpression).optional) {
    return true;
  }
  if (node.type === "MemberExpression" || node.type === "ChainExpression") {
    const child =
      node.type === "ChainExpression"
        ? node.expression
        : node.object;
    return hasOptionalAccess(child);
  }
  return false;
}

function isNonNullShortCircuitGuard(
  current: TSESTree.LogicalExpression,
  node: TSESTree.Node,
  varName: string,
): boolean {
  const left = current.left;
  if (left === node) return true;
  if (left.type === "Identifier" && left.name === varName) return true;
  if (
    left.type === "MemberExpression" &&
    (left as TSESTree.MemberExpression).object.type === "Identifier" &&
    ((left as TSESTree.MemberExpression).object as TSESTree.Identifier).name === varName
  ) {
    return true;
  }
  return false;
}

function checkGuardedConsequent(
  test: TSESTree.Node,
  consequent: TSESTree.Node,
  node: TSESTree.Node,
  varName: string,
): boolean | "stop" {
  if (testContainsGuard(test, varName)) {
    if (walkNodes(consequent, (n) => n === node, { skipTypeAnnotations: true })) return true;
  }
  return "stop";
}

function isNodeAfterInSameBlock(
  ifStatement: TSESTree.Node,
  node: TSESTree.Node,
): boolean {
  const parent = (ifStatement as { parent?: TSESTree.Node }).parent;
  if (
    parent &&
    (parent.type === "BlockStatement" || parent.type === "Program")
  ) {
    const body =
      parent.type === "BlockStatement"
        ? parent.body
        : (parent as TSESTree.Program).body;
    const ifIndex = body.indexOf(ifStatement as any);
    if (ifIndex < 0) return false;
    for (let i = ifIndex + 1; i < body.length; i++) {
      if (walkNodes(body[i], (n) => n === node, { skipTypeAnnotations: true })) return true;
    }
  }
  return false;
}

function isTerminatingStatement(stmt: TSESTree.Node): boolean {
  if (stmt.type === "ThrowStatement") return true;
  if (stmt.type === "ReturnStatement") return true;
  if (stmt.type === "BlockStatement") {
    return (stmt as TSESTree.BlockStatement).body.some(isTerminatingStatement);
  }
  return false;
}

function testContainsIsNullGuard(
  test: TSESTree.Node,
  varName: string,
): boolean {
  if (test.type === "BinaryExpression") {
    const bin = test as TSESTree.BinaryExpression;
    const { left, right, operator } = bin;
    const isGuardOperator = ["!=", "==", "===", "!=="].includes(operator);
    if (!isGuardOperator) return false;

    const leftIsVar = left.type === "Identifier" && left.name === varName;
    const rightIsVar = right.type === "Identifier" && right.name === varName;
    if (!(leftIsVar || rightIsVar)) return false;

    const other = leftIsVar ? right : left;
    const isNullCheck =
      other.type === "Literal" &&
      (other.value === null || other.value === undefined);
    const isUndefinedId =
      other.type === "Identifier" && other.name === "undefined";

    if (isNullCheck || isUndefinedId) {
      if (operator === "===" || operator === "==") return true;
      return false;
    }

    const leftIsTypeofVar =
      left.type === "UnaryExpression" &&
      left.operator === "typeof" &&
      left.argument.type === "Identifier" &&
      left.argument.name === varName;
    const rightIsStringLiteral =
      right.type === "Literal" && typeof right.value === "string";
    if (leftIsTypeofVar && rightIsStringLiteral) {
      return operator === "===" || operator === "==";
    }
    const rightIsTypeofVar =
      right.type === "UnaryExpression" &&
      right.operator === "typeof" &&
      right.argument.type === "Identifier" &&
      right.argument.name === varName;
    const leftIsStringLiteral =
      left.type === "Literal" && typeof left.value === "string";
    if (rightIsTypeofVar && leftIsStringLiteral) {
      return operator === "===" || operator === "==";
    }
  }

  if (test.type === "LogicalExpression") {
    return testContainsIsNullGuard(
      (test as TSESTree.LogicalExpression).left,
      varName,
    );
  }

  if (test.type === "UnaryExpression") {
    const unary = test as TSESTree.UnaryExpression;
    if (unary.operator === "!" && unary.argument.type === "Identifier" && unary.argument.name === varName) {
      return true;
    }
    return testContainsIsNullGuard(unary.argument, varName);
  }

  return false;
}

function isInsideIfGuard(
  current: TSESTree.IfStatement,
  node: TSESTree.Node,
  varName: string,
): boolean | "stop" {
  const result = checkGuardedConsequent(current.test, current.consequent, node, varName);
  if (result === true) return true;
  if (result === "stop" && !testContainsIsNullGuard(current.test, varName)) return "stop";

  if (
    testContainsIsNullGuard(current.test, varName) &&
    isTerminatingStatement(current.consequent) &&
    isNodeAfterInSameBlock(current, node)
  ) return true;

  // if (x != null) { ... } else { throw }; — code after is guarded
  if (
    current.alternate &&
    testContainsGuard(current.test, varName) &&
    isTerminatingStatement(current.alternate) &&
    isNodeAfterInSameBlock(current, node)
  ) return true;

  return "stop";
}

function isInsideTernaryGuard(
  current: TSESTree.ConditionalExpression,
  node: TSESTree.Node,
  varName: string,
): boolean | "stop" {
  return checkGuardedConsequent(current.test, current.consequent, node, varName);
}

function isAndGuard(
  current: TSESTree.LogicalExpression,
  varName: string,
): boolean {
  return testContainsGuard(current.left, varName);
}

function isGuardCall(
  current: TSESTree.CallExpression,
  varName: string,
): boolean {
  const callee = current.callee;
  if (
    callee.type === "Identifier" &&
    /\b(assert|guard|check|require|ensure)\b/i.test(callee.name)
  ) {
    const args = current.arguments;
    if (args.length > 0 && args[0].type === "Identifier" && args[0].name === varName) return true;
    if (
      args.length > 0 &&
      args[0].type === "BinaryExpression" &&
      testContainsGuard(args[0], varName)
    ) return true;
  }
  return false;
}

function isNonNullAssertion(
  current: TSESTree.TSNonNullExpression,
  varName: string,
): boolean {
  const expr = current.expression;
  return expr.type === "Identifier" && expr.name === varName;
}

function isScopeBoundary(node: TSESTree.Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "Program"
  );
}

function isFoundGuard(
  current: TSESTree.Node,
  node: TSESTree.Node,
  varName: string,
): boolean {
  if (current.type === "LogicalExpression") {
    if (current.operator === "??" && isNonNullShortCircuitGuard(current, node, varName)) {
      return true;
    }
    if (current.operator === "&&" && isAndGuard(current, varName)) {
      return true;
    }
  }
  if (current.type === "CallExpression" && isGuardCall(current, varName)) return true;
  if (current.type === "TSNonNullExpression" && isNonNullAssertion(current, varName)) return true;
  return false;
}

function checkNodeInGuard(
  current: TSESTree.Node,
  node: TSESTree.Node,
  varName: string,
): "found" | "stop" | "continue" {
  if (isFoundGuard(current, node, varName)) return "found";

  if (
    current.type === "IfStatement" ||
    current.type === "ConditionalExpression"
  ) {
    const result =
      current.type === "IfStatement"
        ? isInsideIfGuard(current, node, varName)
        : isInsideTernaryGuard(current, node, varName);
    if (result) return "found";
    return "stop";
  }

  return "continue";
}

function isInsideGuard(
  node: TSESTree.Node,
  varName: string,
  sourceCode: TSESLint.SourceCode,
): boolean {
  // getAncestors returns from root to immediate parent, so reverse for
  // leaf-to-root traversal.
  const ancestors = [...sourceCode.getAncestors(node)].reverse();
  for (let i = 0; i < ancestors.length; i++) {
    const current = ancestors[i];
    if (isScopeBoundary(current)) break;

    const result = checkNodeInGuard(current, node, varName);
    if (result === "found") return true;
    if (result === "stop") break;
  }
  return false;
}

function isBinaryGuard(
  test: TSESTree.BinaryExpression,
  varName: string,
): boolean {
  const { left, right, operator } = test;
  const isGuardOperator = [
    "!==",
    "!=",
    "===",
    "==",
  ].includes(operator);
  if (!isGuardOperator) return false;

  const leftIsVar =
    left.type === "Identifier" && left.name === varName;
  const rightIsVar =
    right.type === "Identifier" && right.name === varName;

  if (!(leftIsVar || rightIsVar)) return false;

  const other = leftIsVar ? right : left;
  const isNullCheck =
    other.type === "Literal" &&
    (other.value === null || other.value === undefined);
  const isUndefinedId =
    other.type === "Identifier" && other.name === "undefined";

  if (isNullCheck || isUndefinedId) {
    if (operator === "!==" || operator === "!=") {
      return true;
    }
    return false;
  }

  return typeofGuardMatches(left, right, varName, operator);
}

function typeofGuardMatches(
  left: TSESTree.Node,
  right: TSESTree.Node,
  varName: string,
  operator: string,
): boolean {
  if (operator !== "!==" && operator !== "!=") return false;

  const leftIsTypeofVar =
    left.type === "UnaryExpression" &&
    left.operator === "typeof" &&
    left.argument.type === "Identifier" &&
    left.argument.name === varName;
  const rightIsStringLiteral =
    right.type === "Literal" && typeof right.value === "string";

  if (leftIsTypeofVar && rightIsStringLiteral) return true;

  const rightIsTypeofVar =
    right.type === "UnaryExpression" &&
    right.operator === "typeof" &&
    right.argument.type === "Identifier" &&
    right.argument.name === varName;
  const leftIsStringLiteral =
    left.type === "Literal" && typeof left.value === "string";

  if (rightIsTypeofVar && leftIsStringLiteral) return true;

  return false;
}

function testContainsGuard(
  test: TSESTree.Node,
  varName: string,
): boolean {
  if (test.type === "BinaryExpression") {
    return isBinaryGuard(test as TSESTree.BinaryExpression, varName);
  }

  if (test.type === "LogicalExpression") {
    const { left, operator } = test;
    if (
      (operator === "&&" || operator === "??") &&
      left.type === "Identifier" &&
      left.name === varName
    ) {
      return true;
    }
    return testContainsGuard(left, varName);
  }

  if (test.type === "UnaryExpression") {
    const { argument, operator } = test as TSESTree.UnaryExpression;
    if (operator === "!" && argument.type === "BinaryExpression") {
      return testContainsGuard(argument, varName);
    }
  }

  return false;
}

function findBindingInScope(
  scope: TSESLint.Scope.Scope | null,
  name: string,
): TSESLint.Scope.Variable | null {
  let current: TSESLint.Scope.Scope | null = scope;
  while (current) {
    const variable = current.variables.find((v) => v.name === name);
    if (variable) return variable;
    current = current.upper;
  }
  return null;
}

export default createRule({
  name: "require-undefined-handling-after-optional-chain",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require undefined handling after optional chaining before dereferencing the result",
    },
    messages: {
      unguardedAccess:
        "The variable `{{name}}` may be `undefined` from optional chaining. Handle it with `??` or a guard before accessing `{{member}}`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC16-nullability.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unguardedAccess", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};
    const checker = program.getTypeChecker();

    // Track variables declared from optional chain that may be undefined
    const undefinedChainVars = new Set<TSESLint.Scope.Variable>();

    return {
      VariableDeclarator(node) {
        if (!node.init) return;

       const init = node.init;

        // Skip if init is a ?? expression (undefined is already handled)
        if (init.type === "LogicalExpression" && init.operator === "??") {
          if (hasOptionalAccess(init.left)) return;
          return;
        }

        if (init.type !== "ChainExpression") return;

        if (!hasOptionalAccess(init)) return;

        // Skip if already handled with ??
        const parent = (node as { parent?: TSESTree.Node }).parent;
       if (
            parent?.type === "LogicalExpression" &&
            parent.operator === "??"
          ) {
           return;
         }

        const declName =
          node.id.type === "Identifier" ? node.id.name : null;
        if (!declName) return;

        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(init);
        if (!tsNode) return;
        const type = checker.getTypeAtLocation(tsNode);
        if (typeIncludesUndefined(type)) {
          const scope = context.sourceCode.getScope(node);
          const declaredBinding = scope.variables.find(
            (v) => v.name === declName,
          );
          if (declaredBinding) {
            undefinedChainVars.add(declaredBinding);
          }
        }
      },

      CallExpression(callNode) {
        if (callNode.callee.type !== "Identifier") return;

        const varName = callNode.callee.name;
        const binding = findBindingInScope(
          context.sourceCode.getScope(callNode),
          varName,
        );
        if (!binding || !undefinedChainVars.has(binding)) return;

        if (isInsideGuard(callNode, varName, context.sourceCode)) return;

        context.report({
          node: callNode,
          messageId: "unguardedAccess",
          data: {
            name: varName,
            member: "()",
          },
        });
      },

      MemberExpression(memberNode) {
        if (memberNode.object.type !== "Identifier") return;

        const varName = memberNode.object.name;
        const binding = findBindingInScope(
          context.sourceCode.getScope(memberNode),
          varName,
        );
        if (!binding || !undefinedChainVars.has(binding)) return;

        // Skip if this MemberExpression itself is part of an optional chain
        // (it's already safe)
        if (memberNode.optional) return;

        // getAncestors returns from root to immediate parent, so reverse for
        // leaf-to-root traversal.
        const ancestors = [...context.sourceCode.getAncestors(memberNode)].reverse();

        // Skip if inside an IfStatement's test or ConditionalExpression's test
        // — the guard short-circuits before evaluating.
        for (const anc of ancestors) {
          if (isScopeBoundary(anc)) break;
          if (
            anc.type === "IfStatement" &&
            walkNodes(anc.test, (n) => n === memberNode, { skipTypeAnnotations: true })
          ) return;
          if (
            anc.type === "ConditionalExpression" &&
            walkNodes(anc.test, (n) => n === memberNode, { skipTypeAnnotations: true })
          ) return;
        }

        // Check for sibling throw-guard: if (x === undefined) throw; use after
        for (const anc of ancestors) {
          if (anc.type === "FunctionDeclaration" || anc.type === "FunctionExpression" || anc.type === "ArrowFunctionExpression") break;
          if (
            (anc.type === "BlockStatement" || anc.type === "Program") &&
            !memberNode.optional
          ) {
            const blockBody =
              anc.type === "BlockStatement"
                ? anc.body
                : (anc as TSESTree.Program).body;
            let foundGuard = false;
            for (let i = 0; i < blockBody.length; i++) {
              const stmt = blockBody[i];
              if (
                stmt.type === "IfStatement" &&
                testContainsIsNullGuard(stmt.test, varName) &&
                isTerminatingStatement(stmt.consequent)
              ) {
                foundGuard = true;
              }
              if (walkNodes(stmt, (n) => n === memberNode, { skipTypeAnnotations: true })) {
                if (foundGuard) return;
                break;
              }
            }
          }
        }

        // Check if this use is inside a guard
        if (isInsideGuard(memberNode, varName, context.sourceCode)) return;

        // Get the member name for the message
        let memberName = "";
        if (memberNode.property.type === "Identifier") {
          memberName = memberNode.property.name;
        } else if (memberNode.property.type === "Literal") {
          memberName = String(memberNode.property.value);
        }

        context.report({
          node: memberNode,
          messageId: "unguardedAccess",
          data: {
            name: varName,
            member: memberName,
          },
        });
      },
    };
  },
});
