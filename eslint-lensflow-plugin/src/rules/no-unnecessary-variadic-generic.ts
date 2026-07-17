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
          destructuredIds: Set<string>;
          calls: string[];
        }
      >
    > = [];

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

    function collectDestructuredIdentifiers(
      node: TSESTree.Node,
    ): string[] {
      const identifiers: string[] = [];

      if (node.type === AST_NODE_TYPES.Identifier) {
        identifiers.push(node.name);
      } else if (node.type === AST_NODE_TYPES.ObjectPattern) {
        for (const prop of node.properties) {
          if (prop.type === AST_NODE_TYPES.Property) {
            identifiers.push(
              ...collectDestructuredIdentifiers(prop.value),
            );
          }
        }
      } else if (node.type === AST_NODE_TYPES.ArrayPattern) {
        for (const element of node.elements) {
          if (element) {
            identifiers.push(...collectDestructuredIdentifiers(element));
          }
        }
      } else if (node.type === AST_NODE_TYPES.AssignmentPattern) {
        identifiers.push(...collectDestructuredIdentifiers(node.left));
      } else if (node.type === AST_NODE_TYPES.RestElement) {
        identifiers.push(...collectDestructuredIdentifiers(node.argument));
      }

      return identifiers;
    }

    function findGenericInTypeLiteral(
      typeNode: TSESTree.TSTypeLiteral,
      generics: Map<string, unknown>,
    ): string | undefined {
      for (const member of typeNode.members) {
        if (
          member.type === AST_NODE_TYPES.TSPropertySignature &&
          member.typeAnnotation
        ) {
          const found = findGenericReference(
            member.typeAnnotation.typeAnnotation,
            generics,
          );
          if (found) return found;
        } else if (
          member.type === AST_NODE_TYPES.TSCallSignatureDeclaration &&
          member.returnType
        ) {
          const found = findGenericReference(
            member.returnType.typeAnnotation,
            generics,
          );
          if (found) return found;
        }
      }
      return undefined;
    }

    function findGenericInUnionOrIntersection(
      typeNode: TSESTree.TSUnionType | TSESTree.TSIntersectionType,
      generics: Map<string, unknown>,
    ): string | undefined {
      for (const type of typeNode.types) {
        const found = findGenericReference(type, generics);
        if (found) return found;
      }
      return undefined;
    }

    function findGenericInIndexedAccess(
      typeNode: TSESTree.TSIndexedAccessType,
      generics: Map<string, unknown>,
    ): string | undefined {
      const foundInType = findGenericReference(typeNode.objectType, generics);
      if (foundInType) return foundInType;
      return findGenericReference(typeNode.indexType, generics);
    }

    function findGenericReference(
      typeNode: TSESTree.TypeNode,
      generics: Map<string, unknown>,
    ): string | undefined {
      if (
        typeNode.type === AST_NODE_TYPES.TSTypeReference &&
        typeNode.typeName.type === AST_NODE_TYPES.Identifier &&
        generics.has(typeNode.typeName.name)
      ) {
        return typeNode.typeName.name;
      }

      if (
        typeNode.type === AST_NODE_TYPES.TSIntersectionType ||
        typeNode.type === AST_NODE_TYPES.TSUnionType
      ) {
        return findGenericInUnionOrIntersection(typeNode, generics);
      }
      if (typeNode.type === AST_NODE_TYPES.TSTypeLiteral) {
        return findGenericInTypeLiteral(typeNode, generics);
      }
      if (typeNode.type === AST_NODE_TYPES.TSIndexedAccessType) {
        return findGenericInIndexedAccess(typeNode, generics);
      }

      return undefined;
    }

    function matchParamToGeneric(
      param: TSESTree.Parameter,
      generics: Map<string, unknown>,
    ): { genName: string; destructuredIds: string[] } | undefined {
      if (param.type === AST_NODE_TYPES.TSParameterProperty) return undefined;
      if (!param.typeAnnotation) return undefined;

      // Handle Identifier parameters
      if (param.type === AST_NODE_TYPES.Identifier) {
        const typeAnn = param.typeAnnotation.typeAnnotation;
        if (
          typeAnn.type === AST_NODE_TYPES.TSTypeReference &&
          typeAnn.typeName.type === AST_NODE_TYPES.Identifier &&
          generics.has(typeAnn.typeName.name)
        ) {
          return { genName: typeAnn.typeName.name, destructuredIds: [] };
        }
      }

      // Handle destructured parameters (ObjectPattern / ArrayPattern)
      if (
        param.type === AST_NODE_TYPES.ObjectPattern ||
        param.type === AST_NODE_TYPES.ArrayPattern
      ) {
        const typeAnn = param.typeAnnotation.typeAnnotation;
        const genName = findGenericReference(typeAnn, generics);
        if (genName) {
          const destructuredIds = collectDestructuredIdentifiers(param);
          return { genName, destructuredIds };
        }
      }

      return undefined;
    }

    function collectArrayConstrainedParams(
      typeParams: TSESTree.TSTypeParameterDeclaration,
    ): Map<string, { node: TSESTree.TSTypeParameter; constraintText: string }> {
      const result = new Map<
        string,
        { node: TSESTree.TSTypeParameter; constraintText: string }
      >();

      for (const tp of typeParams.params) {
        if (!tp.constraint || tp.name.type !== AST_NODE_TYPES.Identifier)
          continue;

        const constraintText = getArrayConstraintText(tp.constraint);
        if (constraintText) {
          result.set(tp.name.name, { node: tp, constraintText });
        }
      }

      return result;
    }

    function matchParamsToGenerics(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
      generics: Map<
        string,
        {
          node: TSESTree.TSTypeParameter;
          constraintText: string;
          paramBinding: TSESLint.Scope.Variable | undefined;
          destructuredIds: Set<string>;
          calls: string[];
        }
      >,
    ) {
      if (!node.body) return;

      const fnScope = context.sourceCode.getScope(node);
      for (const param of node.params) {
        const match = matchParamToGeneric(param, generics);
        if (!match) continue;

        const genData = generics.get(match.genName);
        if (!genData) continue;

        if (param.type === AST_NODE_TYPES.Identifier) {
          genData.paramBinding = fnScope.set.get(param.name);
        }
        genData.destructuredIds = new Set(match.destructuredIds);
      }
    }

    function enterFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const typeParams = node.typeParameters;
      if (!typeParams || typeParams.params.length === 0) {
        fnStack.push(new Map());
        return;
      }

      const arrayConstrained = collectArrayConstrainedParams(typeParams);

      const generics = new Map<
        string,
        {
          node: TSESTree.TSTypeParameter;
          constraintText: string;
          paramBinding: TSESLint.Scope.Variable | undefined;
          destructuredIds: Set<string>;
          calls: string[];
        }
      >();

      for (const [genName, info] of arrayConstrained) {
        generics.set(genName, {
          ...info,
          paramBinding: undefined,
          destructuredIds: new Set(),
          calls: [],
        });
      }

      matchParamsToGenerics(node, generics);
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
    }

    function resolveVariable(
      name: string,
      node: TSESTree.Node,
    ): TSESLint.Scope.Variable | undefined {
      let scope: TSESLint.Scope.Scope | null = context.sourceCode.getScope(node);
      while (scope) {
        for (const v of scope.variables) {
          if (v.name === name) return v;
        }
        scope = scope.upper;
      }
      return undefined;
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
        const resolved = resolveVariable(varId.name, callNode);

        for (let i = fnStack.length - 1; i >= 0; i--) {
          for (const data of fnStack[i].values()) {
            if (
              resolved === data.paramBinding ||
              data.destructuredIds.has(varId.name)
            ) {
              data.calls.push(methodName);
              return;
            }
          }
        }
      },
    };
  },
});
