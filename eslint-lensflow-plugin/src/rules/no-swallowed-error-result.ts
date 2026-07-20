import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC08-error-handling.md");

function isOkCheck(node: TSESTree.Expression): boolean {
  if (node.type === "MemberExpression") {
    const prop = node.property;
    if (
      !node.computed &&
      prop.type === "Identifier" &&
      /^ok$/i.test(prop.name)
    ) {
      return true;
    }
  }
  if (node.type === "CallExpression") {
    const callee = node.callee;
    if (
      callee.type === "MemberExpression" &&
      callee.property.type === "Identifier" &&
      /^is(Right|Left)$/i.test(callee.property.name)
    ) {
      return true;
    }
  }
  return false;
}

function isTrivialConsoleCall(stmt: TSESTree.Statement): boolean {
  if (stmt.type !== "ExpressionStatement") return false;
  const expr = stmt.expression;
  if (expr.type !== "CallExpression") return false;
  const callee = expr.callee;
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "console")
    return false;
  const method = callee.property;
  if (method.type !== "Identifier") return false;
  if (!/^(log|error)$/i.test(method.name)) return false;
  return expr.arguments.every(
    (arg) => arg.type === "Literal" && typeof (arg as TSESTree.Literal).value === "string",
  );
}

export default createRule({
  name: "no-swallowed-error-result",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty or trivially logged else branches when handling a Result/Either discriminated union, which silently discards the error.",
    },
    messages: {
      emptyElse:
        "Error branch is empty — the error is silently ignored. Handle the error or rethrow it. See: {{url}}",
      trivialLog:
        "Error branch only logs a bare string — the actual error value is lost. Inspect and handle the error properly. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyElse" | "trivialLog", []>) {
    return {
      IfStatement(node) {
        if (!isOkCheck(node.test)) return;
        const alt = node.alternate;
        if (!alt) return;

        if (alt.type === "BlockStatement") {
          const body = alt.body;
          if (body.length === 0) {
            context.report({
              node: alt,
              messageId: "emptyElse",
              data: { url: URL },
            });
            return;
          }
          if (
            body.length === 1 &&
            isTrivialConsoleCall(body[0])
          ) {
            context.report({
              node: alt,
              messageId: "trivialLog",
              data: { url: URL },
            });
          }
        } else if (alt.type === "ExpressionStatement" && isTrivialConsoleCall(alt)) {
          context.report({
            node: alt,
            messageId: "trivialLog",
            data: { url: URL },
          });
        }
      },
    };
  },
});
