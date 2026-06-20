import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-boolean-parse-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow parse/validate/check functions that return bare boolean instead of a typed Result with error details",
    },
    messages: {
      booleanParseReturn:
        "Function `{{name}}` returns `boolean` instead of a typed `Result<T, E>`. Callers can't distinguish failure reasons or recover the parsed value. Return `Result<T, E>` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"booleanParseReturn", []>) {
    const NAME_PATTERN = /^(parse|validate|check|parseAndValidate)/i;

    // Stack of enclosing VariableDeclarator identifiers so we can derive the function name
    // from the variable when the function itself has no id (arrows, anonymous FE).
    // Using a stack handles nested VariableDeclarators with destructuring patterns correctly.
    const declaratorIds: (TSESTree.Identifier | undefined)[] = [];

    function checkFunction(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) {
      // Prefer the function's own id (FunctionDeclaration, named FunctionExpression).
      // Fall back to the enclosing VariableDeclarator's id (arrow, anonymous FE).
      const nameNode =
        node.type === "FunctionDeclaration"
          ? node.id
          : node.type === "FunctionExpression" && node.id
            ? node.id
            : declaratorIds[declaratorIds.length - 1];

      if (!nameNode) return;
      if (!NAME_PATTERN.test(nameNode.name)) return;

      const returnType = node.returnType?.typeAnnotation;
      if (returnType?.type === "TSBooleanKeyword") {
        context.report({
          node: nameNode,
          messageId: "booleanParseReturn",
          data: { name: nameNode.name },
        });
      }
    }

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        declaratorIds.push(node.id.type === "Identifier" ? node.id : undefined);
      },
      "VariableDeclarator:exit"() {
        declaratorIds.pop();
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
    };
  },
});
