import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

const ValidationPattern = /^(?:valid|check|assert|parse)/;

function extractMemberParts(
  callee: TSESTree.MemberExpression,
): string[] {
  const parts: string[] = [];
  let cur: TSESTree.MemberExpression | TSESTree.Identifier = callee;
  while (true) {
    if (cur.type === AST_NODE_TYPES.Identifier) {
      parts.push(cur.name);
      break;
    }
    if (cur.property.type === AST_NODE_TYPES.Identifier) {
      parts.push(cur.property.name);
    }
    const next: TSESTree.Expression = cur.object;
    if (
      next.type === AST_NODE_TYPES.MemberExpression ||
      next.type === AST_NODE_TYPES.Identifier
    ) {
      cur = next as TSESTree.MemberExpression | TSESTree.Identifier;
    } else {
      break;
    }
  }
  return parts;
}

function isValidationCall(node: TSESTree.CallExpression): boolean {
  if (
    node.callee.type === AST_NODE_TYPES.Identifier &&
    ValidationPattern.test(node.callee.name)
  )
    return true;

  if (node.callee.type === AST_NODE_TYPES.MemberExpression) {
    const parts = extractMemberParts(node.callee);
    return parts.some((p) => ValidationPattern.test(p));
  }
  return false;
}

function hasValidCall(body: TSESTree.BlockStatement): boolean {
  return walkNodes(body, (node) => {
    if (node.type !== AST_NODE_TYPES.CallExpression) return false;
    return isValidationCall(node);
  });
}

function bodyHasValidation(
  body: TSESTree.BlockStatement,
  className: string,
): boolean {
  return body.body.some((stmt) => {
    if (stmt.type === AST_NODE_TYPES.ThrowStatement) return true;
    if (
      stmt.type === AST_NODE_TYPES.ReturnStatement &&
      stmt.argument?.type === AST_NODE_TYPES.NewExpression &&
      stmt.argument.callee.type === AST_NODE_TYPES.Identifier &&
      stmt.argument.callee.name === className
    )
      return true;
    if (
      stmt.type === AST_NODE_TYPES.ExpressionStatement &&
      stmt.expression.type === AST_NODE_TYPES.CallExpression
    ) {
      return isValidationCall(stmt.expression);
    }
    if (stmt.type === AST_NODE_TYPES.IfStatement) {
      return isValidationGuard(stmt, className);
    }
    return false;
  });
}

function isValidationGuard(
  node: TSESTree.IfStatement,
  className: string,
): boolean {
  if (node.consequent.type === AST_NODE_TYPES.BlockStatement) {
    if (bodyHasValidation(node.consequent, className)) return true;
  }
  if (node.consequent.type === AST_NODE_TYPES.ThrowStatement) {
    return true;
  }
  if (
    node.consequent.type === AST_NODE_TYPES.ReturnStatement &&
    node.consequent.argument?.type === AST_NODE_TYPES.NewExpression &&
    node.consequent.argument.callee.type === AST_NODE_TYPES.Identifier &&
    node.consequent.argument.callee.name === className
  ) {
    return true;
  }
  if (
    node.consequent.type === AST_NODE_TYPES.ExpressionStatement &&
    node.consequent.expression.type === AST_NODE_TYPES.CallExpression
  ) {
    if (isValidationCall(node.consequent.expression)) return true;
  }
  if (node.alternate && node.alternate.type === AST_NODE_TYPES.BlockStatement) {
    if (bodyHasValidation(node.alternate, className)) return true;
  }
  if (node.alternate?.type === AST_NODE_TYPES.ThrowStatement) {
    return true;
  }
  if (
    node.alternate?.type === AST_NODE_TYPES.ReturnStatement &&
    node.alternate.argument?.type === AST_NODE_TYPES.NewExpression &&
    node.alternate.argument.callee.type === AST_NODE_TYPES.Identifier &&
    node.alternate.argument.callee.name === className
  ) {
    return true;
  }
  if (
    node.alternate?.type === AST_NODE_TYPES.ExpressionStatement &&
    node.alternate.expression.type === AST_NODE_TYPES.CallExpression
  ) {
    if (isValidationCall(node.alternate.expression)) return true;
  }
  if (node.alternate?.type === AST_NODE_TYPES.IfStatement) {
    return isValidationGuard(node.alternate, className);
  }
  return false;
}

function hasTopLevelGuard(
  body: TSESTree.BlockStatement,
  className: string,
): boolean {
  return body.body.some((stmt) => {
    if (stmt.type === AST_NODE_TYPES.ThrowStatement) return true;
    if (
      stmt.type === AST_NODE_TYPES.IfStatement &&
      isValidationGuard(stmt, className)
    )
      return true;
    return false;
  });
}

function hasReturnNewClass(
  body: TSESTree.BlockStatement,
  className: string,
): boolean {
  return walkNodes(body, (node) => {
    if (node.type !== AST_NODE_TYPES.ReturnStatement) return false;
    if (
      node.argument?.type === AST_NODE_TYPES.NewExpression &&
      node.argument.callee.type === AST_NODE_TYPES.Identifier &&
      node.argument.callee.name === className
    )
      return true;
    return false;
  });
}

export default createRule({
  name: "no-private-constructor-unvalidated-factory",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows static factory methods on classes with private constructors that perform no validation",
    },
    messages: {
      unvalidatedFactory:
        "Private constructor is pointless because factory method '{{name}}' does no validation. Add validation or make the constructor public. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC10-encapsulation.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unvalidatedFactory", []>) {
    return {
      ClassBody(node) {
        const classNode = node.parent;
        const className =
          classNode.type === AST_NODE_TYPES.ClassDeclaration ||
          classNode.type === AST_NODE_TYPES.ClassExpression
            ? classNode.id?.name
            : undefined;

        if (!className) return;

        const hasPrivateConstructor = node.body.some(
          (member) =>
            member.type === AST_NODE_TYPES.MethodDefinition &&
            member.kind === "constructor" &&
            member.accessibility === "private",
        );

        if (!hasPrivateConstructor) return;

        const staticMethods = node.body.filter(
          (member) =>
            member.type === AST_NODE_TYPES.MethodDefinition &&
            member.static === true,
        ) as TSESTree.MethodDefinition[];

        for (const method of staticMethods) {
          if (method.kind === "constructor") continue;
          if (!method.value?.body) continue;

          const fallbackName =
            method.key.type === AST_NODE_TYPES.Literal
              ? String(method.key.value)
              : "unknown";
          const methodName =
            method.key.type === AST_NODE_TYPES.Identifier
              ? method.key.name
              : fallbackName;
          const body = method.value.body;

          const hasValidation =
            hasTopLevelGuard(body, className) || hasValidCall(body);

          const hasDirectNew = hasReturnNewClass(body, className);

          if (!hasValidation && hasDirectNew) {
            context.report({
              node: method,
              messageId: "unvalidatedFactory",
              data: { name: methodName },
            });
          }
        }
      },
    };
  },
});
