import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC19-serialization.md");

export default createRule({
  name: "require-validation-after-json-parse",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require schema validation after JSON.parse before using parsed data",
      // recommendation not supported in this ESLint version
      /**
       * Limitation: scope tracking is per-variable-name, not per-declaration.
       * A JSON.parse in an outer scope leaks into nested function scopes.
       * If an outer variable is validated, the rule will not report its use
       * inside callbacks or nested functions, even though they are logically
       * separate execution contexts. Conversely, an inner scope that shadows
       * an outer variable name with its own JSON.parse will be tracked
       * independently, which is correct.
       *
       * Example of false negative:
       *   const raw = JSON.parse(input);
       *   Schema.parse(raw);
       *   processLater(() => {
       *     // raw is considered validated (from outer scope lookup),
       *     // but the callback is a separate execution context.
       *     database.save(raw);
       *   });
       *
       * For strict per-scope tracking, consider using TypeScript's type
       * system to narrow parsed data types.
       */
    },
    messages: {
      directUnvalidated:
        "JSON.parse result used directly in {{calleeName}} without schema validation. Wrap with a validator like Schema.parse() or Schema.safeParse(). See: {{url}}",
      unvalidatedVariableUsage:
        "Unvalidated JSON.parse result from '{{varName}}' used in {{calleeName}} without passing through a schema validator. Wrap the parse result with Schema.parse() or Schema.safeParse(). See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(
    context: TSESLint.RuleContext<
      "unvalidatedVariableUsage" | "directUnvalidated",
      []
    >,
  ) {
    const scopeStack: Record<string, TSESTree.Node | "validated">[] = [{}];

    const enterScope = () => {
      scopeStack.push({});
    };

    const exitScope = () => {
      scopeStack.pop();
    };

    const currentScope = (): Record<string, TSESTree.Node | "validated"> =>
      scopeStack[scopeStack.length - 1];

    const lookupParsedData = (
      name: string,
    ): TSESTree.Node | "validated" | undefined => {
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
        return /^(safeParse|parse|validate|decode)$/.test(callee.property.name);
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
      node: TSESTree.CallExpression,
    ): TSESTree.CallExpression | null => {
      const p = node.parent;
      if (p?.type !== "CallExpression") return null;
      return p;
    };

    const isVariableDeclaratorWithId = (
      node: TSESTree.CallExpression,
    ): string | null => {
      const p = node.parent;
      if (p?.type !== "VariableDeclarator") return null;
      if (p.id.type !== "Identifier") return null;
      return p.id.name;
    };

    const extractIdentifiersFromPattern = (node: TSESTree.Node): string[] => {
      const identifiers: string[] = [];
      if (node.type === "Identifier") {
        identifiers.push(node.name);
      } else if (node.type === "ObjectPattern") {
        for (const prop of node.properties) {
          if (prop.type === "Property") {
            identifiers.push(...extractIdentifiersFromPattern(prop.value));
          }
        }
      } else if (node.type === "ArrayPattern") {
        for (const element of node.elements) {
          if (element) {
            identifiers.push(...extractIdentifiersFromPattern(element));
          }
        }
      } else if (node.type === "RestElement") {
        identifiers.push(...extractIdentifiersFromPattern(node.argument));
      } else if (node.type === "AssignmentPattern") {
        identifiers.push(...extractIdentifiersFromPattern(node.left));
      }
      return identifiers;
    };

    const checkUnvalidatedArgs = (
      callee: TSESTree.Expression,
      args: TSESTree.CallExpressionArgument[],
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
            url: URL,
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
              url: URL,
            },
          });
        }
        return;
      }

      const varName = isVariableDeclaratorWithId(node);
      if (varName) {
        currentScope()[varName] = node;
        return;
      }

      const p = node.parent;
      if (p?.type === "VariableDeclarator" && p.id.type !== "Identifier") {
        const names = extractIdentifiersFromPattern(p.id);
        for (const name of names) {
          currentScope()[name] = node;
        }
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
        } else {
          const names = extractIdentifiersFromPattern(node.left);
          for (const name of names) {
            untrackVariable(name);
          }
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
