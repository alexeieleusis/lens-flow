import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

interface ParamScope {
  paramName: string;
  typeNode: TSESTree.TSStringKeyword;
  literals: Set<string>;
}

interface FuncScope {
  params: ParamScope[];
}

function normalizeParam(param: TSESTree.Parameter): TSESTree.Node {
  if (param.type === "AssignmentPattern") return param.left;
  if (param.type === "RestElement") return param.argument;
  return param;
}

function getStringParamIdent(param: TSESTree.Parameter): (TSESTree.Identifier & { typeAnnotation: TSESTree.TSTypeAnnotation }) | null {
  const inner = normalizeParam(param);
  if (inner.type !== "Identifier") return null;
  if (!inner.typeAnnotation) return null;
  if (inner.typeAnnotation.typeAnnotation.type !== "TSStringKeyword") return null;
  return inner as TSESTree.Identifier & { typeAnnotation: TSESTree.TSTypeAnnotation };
}

export default createRule({
  name: "no-magic-string-discriminant-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallows string-typed parameters compared against multiple magic string literals, which should use a literal union type instead.",
    },
    messages: {
      magicStringDiscriminant:
        "Parameter \"{{param}}\" is compared against {{count}} distinct string literals (\"{{literals}}\"). Use a literal union type instead of plain string for compile-time exhaustiveness. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC03-exhaustiveness.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicStringDiscriminant", []>) {
    const scopeStack: FuncScope[] = [];

    function enterFunction(fn: TSESTree.FunctionLike) {
      const params: ParamScope[] = [];
      for (const param of fn.params) {
        const ident = getStringParamIdent(param);
        if (ident) {
          params.push({
            paramName: ident.name,
            typeNode: ident.typeAnnotation.typeAnnotation as TSESTree.TSStringKeyword,
            literals: new Set(),
          });
        }
      }
      scopeStack.push({ params });
    }

    function leaveFunction(fn: TSESTree.FunctionLike) {
      const scope = scopeStack.pop();
      if (!scope) return;

      for (const param of scope.params) {
        if (param.literals.size >= 2) {
          context.report({
            node: param.typeNode,
            messageId: "magicStringDiscriminant",
            data: {
              param: param.paramName,
              count: String(param.literals.size),
              literals: [...param.literals].join("\", \""),
            },
          });
        }
      }
    }

    function topScope(): FuncScope | undefined {
      return scopeStack[scopeStack.length - 1];
    }

    function findParamScope(paramName: string): ParamScope | undefined {
      for (let i = scopeStack.length - 1; i >= 0; i--) {
        const found = scopeStack[i].params.find((p) => p.paramName === paramName);
        if (found) return found;
      }
      return undefined;
    }

    return {
      FunctionDeclaration: enterFunction,
      FunctionExpression: enterFunction,
      ArrowFunctionExpression: enterFunction,
      TSDeclareFunction(node) {
        enterFunction(node as TSESTree.FunctionLike);
      },
      TSFunctionType(node) {
        enterFunction(node as unknown as TSESTree.FunctionLike);
      },
      TSMethodSignature(node) {
        enterFunction(node as unknown as TSESTree.FunctionLike);
      },
      MethodDefinition(node) {
        enterFunction(node.value as TSESTree.FunctionLike);
      },
      "FunctionDeclaration:exit": leaveFunction,
      "FunctionExpression:exit": leaveFunction,
      "ArrowFunctionExpression:exit": leaveFunction,
      "TSDeclareFunction:exit"(node) {
        leaveFunction(node as TSESTree.FunctionLike);
      },
      "TSFunctionType:exit"(node) {
        leaveFunction(node as unknown as TSESTree.FunctionLike);
      },
      "TSMethodSignature:exit"(node) {
        leaveFunction(node as unknown as TSESTree.FunctionLike);
      },
      "MethodDefinition:exit"(node) {
        leaveFunction(node.value as TSESTree.FunctionLike);
      },
      BinaryExpression(node) {
        if (scopeStack.length === 0) return;
        const OPS = new Set(["===", "==", "!==", "!="]);
        if (!OPS.has(node.operator)) return;

        const left = node.left;
        const right = node.right;

        let paramName: string | null = null;

        if (
          left.type === "Identifier" &&
          findParamScope(left.name) &&
          right.type === "Literal" &&
          typeof right.value === "string"
        ) {
          paramName = left.name;
        } else if (
          right.type === "Identifier" &&
          findParamScope(right.name) &&
          left.type === "Literal" &&
          typeof left.value === "string"
        ) {
          paramName = right.name;
        }

        if (paramName) {
          const paramScope = findParamScope(paramName);
          if (paramScope) {
            const literalValue =
              left.type === "Literal" && typeof left.value === "string"
                ? left.value
                : (right as TSESTree.Literal).value;
            paramScope.literals.add(literalValue as string);
          }
        }
      },
    };
  },
});
