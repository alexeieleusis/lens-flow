import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T52-literal-types.md");

interface ParamScope {
  paramIdent: TSESTree.Identifier;
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

function getLiteralStringValue(node: TSESTree.Node): string | null {
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (
    node.type === "TemplateLiteral" &&
    node.quasis.length === 1 &&
    node.expressions.length === 0
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

function getStringParamIdent(
  param: TSESTree.Parameter,
):
  (TSESTree.Identifier & { typeAnnotation: TSESTree.TSTypeAnnotation }) | null {
  const inner = normalizeParam(param);
  if (inner.type !== "Identifier") return null;
  if (!inner.typeAnnotation) return null;
  if (inner.typeAnnotation.typeAnnotation.type !== "TSStringKeyword")
    return null;
  return inner as TSESTree.Identifier & {
    typeAnnotation: TSESTree.TSTypeAnnotation;
  };
}

export default createRule({
  name: "no-string-param-with-literal-comparison",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow function parameters typed as `string` that are compared against specific string literals inside the function body",
    },
    messages: {
      stringParamWithLiteralComparison:
        "Parameter '{{name}}' is typed as `string` but compared against {{count}} literal(s) [{{literals}}]. Consider using a literal union type instead. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          minComparisons: {
            type: "integer",
            minimum: 1,
            description:
              "Minimum number of distinct string literal comparisons before the rule fires. Default is 1.",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{}],
  create(
    context: TSESLint.RuleContext<
      "stringParamWithLiteralComparison",
      [{ minComparisons?: number }]
    >,
  ) {
    const { minComparisons = 1 } = context.options[0] || {};
    const scopeStack: FuncScope[] = [];
    const sourceCode = context.sourceCode;

    function enterFunction(fn: TSESTree.FunctionLike) {
      const params: ParamScope[] = [];
      for (const param of fn.params) {
        const ident = getStringParamIdent(param);
        if (ident) {
          params.push({
            paramIdent: ident,
            typeNode: ident.typeAnnotation
              .typeAnnotation as TSESTree.TSStringKeyword,
            literals: new Set(),
          });
        }
      }
      scopeStack.push({ params });
    }

    function leaveFunction(_fn: TSESTree.FunctionLike) {
      const scope = scopeStack.pop();
      if (!scope) return;

      for (const param of scope.params) {
        if (param.literals.size >= minComparisons) {
          context.report({
            node: param.typeNode,
            messageId: "stringParamWithLiteralComparison",
            data: {
              name: param.paramIdent.name,
              count: String(param.literals.size),
              literals: [...param.literals].join("', '"),
              url: URL,
            },
          });
        }
      }
    }

    function currentScope(): FuncScope | undefined {
      return scopeStack[scopeStack.length - 1];
    }

    function resolveParamScope(
      identifier: TSESTree.Identifier,
    ): ParamScope | undefined {
      const scope = sourceCode.getScope(identifier);
      const binding = scope.set.get(identifier.name);
      if (
        !binding ||
        binding.defs.length === 0 ||
        binding.defs[0].type !== "Parameter"
      )
        return undefined;
      const current = currentScope();
      if (!current) return undefined;
      return current.params.find((p) => p.paramIdent === binding.defs[0].name);
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

        let paramScope: ParamScope | undefined;
        let literalValue: string | undefined;

        const rightLiteral = getLiteralStringValue(right);
        const leftLiteral = getLiteralStringValue(left);

        if (left.type === "Identifier" && rightLiteral !== null) {
          paramScope = resolveParamScope(left);
          literalValue = paramScope ? rightLiteral : undefined;
        } else if (right.type === "Identifier" && leftLiteral !== null) {
          paramScope = resolveParamScope(right);
          literalValue = paramScope ? leftLiteral : undefined;
        }

        if (paramScope && literalValue !== undefined) {
          paramScope.literals.add(literalValue);
        }
      },
    };
  },
});
