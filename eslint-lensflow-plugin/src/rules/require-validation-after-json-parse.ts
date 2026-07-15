import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "require-validation-after-json-parse",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require schema validation after JSON.parse before using parsed data",
    },
    messages: {
      directUnvalidated:
        "JSON.parse result used directly in {{calleeName}} without schema validation. Wrap with a validator like Schema.parse() or Schema.safeParse(). See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC19-serialization.md",
      unvalidatedVariableUsage:
        "Unvalidated JSON.parse result from '{{varName}}' used in {{calleeName}} without passing through a schema validator. Wrap the parse result with Schema.parse() or Schema.safeParse(). See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC19-serialization.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unvalidatedVariableUsage" | "directUnvalidated", []>) {
    const scopeStack: Record<string, TSESTree.Node | "validated">[] = [{}];

    const enterScope = () => {
      scopeStack.push({});
    };

    const exitScope = () => {
      scopeStack.pop();
    };

    const currentScope = (): Record<string, TSESTree.Node | "validated"> =>
      scopeStack[scopeStack.length - 1];

    const lookupParsedData = (name: string): TSESTree.Node | "validated" | undefined => {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (name in scopeStack[i]) return scopeStack[i][name];
      }
      return undefined;
    };

    const markValidated = (name: string) => {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (name in scopeStack[i]) {
          scopeStack[i][name] = "validated";
          return;
        }
      }
    };

    const untrackVariable = (name: string) => {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        if (name in scopeStack[i]) {
          delete scopeStack[i][name];
          return;
        }
      }
    };

    const isValidationMethod = (callee: TSESTree.Expression): boolean => {
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier"
      ) {
        return /^(safeParse|parse|validate)$/.test(callee.property.name);
      }
      return false;
    };

    const getCalleeName = (callee: TSESTree.Expression): string => {
      if (
        callee.type === "MemberExpression" &&
        callee.property.type === "Identifier"
      ) {
        return callee.property.name;
      }
      return "unknown";
    };

    const isJsonParseCall = (node: TSESTree.CallExpression): boolean => {
      const { callee } = node;
      return (
        callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        callee.object.name === "JSON" &&
        callee.property.type === "Identifier" &&
        callee.property.name === "parse"
      );
    };

    const isParentCallExpression = (
      node: TSESTree.CallExpression
    ): TSESTree.CallExpression | null => {
      const p = node.parent;
      if (p?.type !== "CallExpression") return null;
      return p;
    };

    const isVariableDeclaratorWithId = (
      node: TSESTree.CallExpression
    ): string | null => {
      const p = node.parent;
      if (p?.type !== "VariableDeclarator") return null;
      if (p.id.type !== "Identifier") return null;
      return p.id.name;
    };

    const checkUnvalidatedArgs = (
      callee: TSESTree.Expression,
      args: TSESTree.CallExpressionArgument[]
    ) => {
      if (isValidationMethod(callee)) {
        for (const arg of args) {
          if (arg.type === "Identifier") {
            markValidated(arg.name);
          }
        }
        return;
      }
      for (const arg of args) {
        if (arg.type !== "Identifier") continue;
        const entry = lookupParsedData(arg.name);
        if (entry === undefined || entry === "validated") continue;
        context.report({
          node: arg,
          messageId: "unvalidatedVariableUsage",
          data: {
            varName: arg.name,
            calleeName: getCalleeName(callee),
          },
        });
      }
    };

    const handleJsonParse = (node: TSESTree.CallExpression) => {
      const parentCall = isParentCallExpression(node);
      if (parentCall) {
        if (
          Array.isArray(parentCall.arguments) &&
          !parentCall.arguments.includes(node)
        ) {
          return;
        }

        if (!isValidationMethod(parentCall.callee)) {
          context.report({
            node,
            messageId: "directUnvalidated",
            data: {
              calleeName: getCalleeName(parentCall.callee),
            },
          });
        }
        return;
      }

      const varName = isVariableDeclaratorWithId(node);
      if (varName) {
        currentScope()[varName] = node;
      }
    };

    return {
      FunctionDeclaration: enterScope,
      FunctionExpression: enterScope,
      ArrowFunctionExpression: enterScope,
      "FunctionDeclaration:exit": exitScope,
      "FunctionExpression:exit": exitScope,
      "ArrowFunctionExpression:exit": exitScope,
      AssignmentExpression(node) {
        if (node.left.type === "Identifier") {
          untrackVariable(node.left.name);
        }
      },
      CallExpression(node) {
        const { callee, arguments: args } = node;

        if (isJsonParseCall(node)) {
          handleJsonParse(node);
          return;
        }

        checkUnvalidatedArgs(callee, args);
      },
    };
  },
});
