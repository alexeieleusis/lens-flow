import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-unnecessary-variadic-generic",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow generic parameters constrained to array types when only simple array methods are used",
    },
    messages: {
      unnecessaryGeneric:
        "Generic parameter {{param}} is constrained to an array type but only simple array methods are called. Use {{constraint}} directly instead of a generic parameter. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T45-paramspec-variadic.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          simpleMethods: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [
    {
      simpleMethods: [
        "reduce",
        "forEach",
        "map",
        "filter",
        "some",
        "every",
        "includes",
        "find",
        "findIndex",
      ],
    },
  ],
  create(
    context: TSESLint.RuleContext<
      "unnecessaryGeneric",
      [{ simpleMethods?: string[] }]
    >,
  ) {
    const firstOption = context.options[0];
    const simpleMethods =
      firstOption?.simpleMethods ?? [
        "reduce",
        "forEach",
        "map",
        "filter",
        "some",
        "every",
        "includes",
        "find",
        "findIndex",
      ];
    const simpleSet = new Set<string>(simpleMethods);

    const fnStack: Array<
      Map<
        string,
        {
          node: TSESTree.TSTypeParameter;
          constraintText: string;
          paramBinding: TSESLint.Scope.Variable | undefined;
          calls: string[];
        }
      >
    > = [];

    let fnDepth = 0;

    function getArrayConstraintText(
      constraint: TSESTree.TypeNode,
    ): string | undefined {
      if (constraint.type === AST_NODE_TYPES.TSArrayType) {
        return context.sourceCode.getText(constraint);
      }

      if (
        constraint.type === AST_NODE_TYPES.TSTypeReference &&
        constraint.typeName.type === AST_NODE_TYPES.Identifier &&
        constraint.typeName.name === "Array"
      ) {
        const typeRef = constraint as TSESTree.TSTypeReference & {
          typeParameters?: TSESTree.TSTypeParameterInstantiation;
        };
        return typeRef.typeParameters?.params.length === 1
          ? `Array<${context.sourceCode.getText(typeRef.typeParameters.params[0])}>`
          : "Array<unknown>";
      }

      return undefined;
    }

    function matchParamToGeneric(
      param: TSESTree.Parameter,
      generics: Map<string, unknown>,
    ): string | undefined {
      if (
        param.type !== AST_NODE_TYPES.Identifier ||
        !param.typeAnnotation
      )
        return undefined;

      const typeAnn = param.typeAnnotation.typeAnnotation;
      if (
        typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
        typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
        generics.has(typeAnn.typeName.name)
      ) {
        return typeAnn.typeName.name;
      }

      return undefined;
    }

    function enterFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      fnDepth++;

      if (fnDepth !== 1) {
        return;
      }

      const typeParams = node.typeParameters;
      if (!typeParams || typeParams.params.length === 0) {
        fnStack.push(new Map());
        return;
      }

      // Find array-constrained type parameters
      const arrayConstrained = new Map<
        string,
        { node: TSESTree.TSTypeParameter; constraintText: string }
      >();

      for (const tp of typeParams.params) {
        if (!tp.constraint || tp.name.type !== AST_NODE_TYPES.Identifier)
          continue;

        const constraintText = getArrayConstraintText(tp.constraint);
        if (constraintText) {
          arrayConstrained.set(tp.name.name, { node: tp, constraintText });
        }
      }

      // Map generic names to function parameter names
      const generics = new Map<
        string,
        {
          node: TSESTree.TSTypeParameter;
          constraintText: string;
          paramBinding: TSESLint.Scope.Variable | undefined;
          calls: string[];
        }
      >();

      for (const [genName, info] of arrayConstrained) {
        generics.set(genName, { ...info, paramBinding: undefined, calls: [] });
      }

      // Match function parameters to generics by type annotation
      if (node.body) {
        const fnScope = context.sourceCode.getScope(node);
        for (const param of node.params) {
          const genName = matchParamToGeneric(param, generics);
          if (genName) {
            if (param.type === AST_NODE_TYPES.Identifier) {
              generics.get(genName)!.paramBinding =
                fnScope.set.get(param.name);
            }
          }
        }
      }

      fnStack.push(generics);
    }

    function exitFn() {
      const generics = fnStack.pop();
      if (!generics) return;

      for (const [genName, data] of generics) {
        if (data.calls.length === 0) continue;

        const allSimple = data.calls.every((m) => simpleSet.has(m));

        if (allSimple) {
          context.report({
            node: data.node,
            messageId: "unnecessaryGeneric",
            data: { param: genName, constraint: data.constraintText },
          });
        }
      }

      fnDepth--;
    }

    return {
      FunctionDeclaration: enterFn,
      "FunctionDeclaration:exit": exitFn,
      FunctionExpression: enterFn,
      "FunctionExpression:exit": exitFn,
      ArrowFunctionExpression: enterFn,
      "ArrowFunctionExpression:exit": exitFn,

      CallExpression(callNode) {
        if (fnStack.length === 0) return;

        if (
          callNode.callee.type !== AST_NODE_TYPES.MemberExpression ||
          callNode.callee.computed ||
          callNode.callee.property.type !== AST_NODE_TYPES.Identifier ||
          callNode.callee.object.type !== AST_NODE_TYPES.Identifier
        )
          return;

        const varId = callNode.callee.object;
        const methodName = callNode.callee.property.name;

        // Resolve the identifier's binding using scope analysis
        let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(callNode);
        let resolved: TSESLint.Scope.Variable | undefined;

        while (scope) {
          for (const v of scope.variables) {
            if (v.name === varId.name) {
              resolved = v;
              break;
            }
          }
          if (resolved) break;
          scope = scope.upper;
        }

        // Walk the stack from innermost to outermost to find the matching generic
        for (let i = fnStack.length - 1; i >= 0; i--) {
          for (const data of fnStack[i].values()) {
            if (resolved === data.paramBinding) {
              data.calls.push(methodName);
              return;
            }
          }
        }
      },
    };
  },
});
