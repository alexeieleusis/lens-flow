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

    let currentFn:
      | {
          generics: Map<
            string,
            {
              node: TSESTree.TSTypeParameter;
              constraintText: string;
              paramNames: string[];
              calls: string[];
            }
          >;
        }
      | null = null;

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
      if (!typeParams || typeParams.params.length === 0 || !node.body) {
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

      if (arrayConstrained.size === 0) return;

      // Map generic names to function parameter names
      const generics = new Map<
        string,
        {
          node: TSESTree.TSTypeParameter;
          constraintText: string;
          paramNames: string[];
          calls: string[];
        }
      >();

      for (const [genName, info] of arrayConstrained) {
        generics.set(genName, { ...info, paramNames: [], calls: [] });
      }

      // Match function parameters to generics by type annotation
      for (const param of node.params) {
        const genName = matchParamToGeneric(param, generics);
        if (genName) {
          if (param.type === AST_NODE_TYPES.Identifier) {
            generics.get(genName)!.paramNames.push(param.name);
          }
        }
      }

      currentFn = { generics };
    }

    function exitFn() {
      if (fnDepth === 1 && currentFn) {
        for (const [genName, data] of currentFn.generics) {
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

        currentFn = null;
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
        if (!currentFn || fnDepth !== 1) return;

        if (
          callNode.callee.type !== AST_NODE_TYPES.MemberExpression ||
          callNode.callee.computed ||
          callNode.callee.property.type !== AST_NODE_TYPES.Identifier ||
          callNode.callee.object.type !== AST_NODE_TYPES.Identifier
        )
          return;

        const varName = callNode.callee.object.name;
        const methodName = callNode.callee.property.name;

        // Find which generic this variable belongs to
        for (const data of currentFn.generics.values()) {
          if (data.paramNames.includes(varName)) {
            data.calls.push(methodName);
            break;
          }
        }
      },
    };
  },
});
