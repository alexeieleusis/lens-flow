import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const ACCESSOR_CONTEXT_TYPES = new Set([
  "ClassAccessorDecoratorContext",
  "ClassAccessorDecoratorTarget",
  "ClassAccessorDecoratorResult",
]);

const FIELD_CONTEXT_TYPES = new Set([
  "ClassFieldDecoratorContext",
  "ClassFieldDecoratorResult",
]);

function getTypeName(typeAnn: TSESTree.TypeNode): string | null {
  if (typeAnn.type === "TSTypeReference") {
    const tn = typeAnn.typeName;
    if (tn.type === "Identifier") return tn.name;
    if (tn.type === "TSQualifiedName") return tn.right.name;
  }
  return null;
}

function hasParamType(
  params: readonly TSESTree.Parameter[],
  typeSet: Set<string>,
): boolean {
  return params.some((p) => {
    const param = p.type === "TSParameterProperty" ? p.parameter : p;
    if (!param.typeAnnotation) return false;
    const name = getTypeName(param.typeAnnotation.typeAnnotation);
    return name !== null && typeSet.has(name);
  });
}

function getDecoratorName(expr: TSESTree.Expression): string | null {
  if (expr.type === "Identifier") return expr.name;
  if (expr.type === "CallExpression") {
    const callee = expr.callee;
    if (callee.type === "Identifier") return callee.name;
    if (
      callee.type === "MemberExpression" &&
      callee.property.type === "Identifier"
    )
      return callee.property.name;
  }
  return null;
}

function findReturnedFunctionParams(
  body: TSESTree.BlockStatement,
): readonly TSESTree.Parameter[] | null {
  for (const stmt of body.body) {
    if (stmt.type === "ReturnStatement" && stmt.argument) {
      const arg = stmt.argument;
      if (
        arg.type === "FunctionExpression" ||
        arg.type === "ArrowFunctionExpression"
      ) {
        return arg.params;
      }
    }
  }
  return null;
}

export default createRule({
  name: "require-decorator-accessor-keyword",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require the `accessor` keyword on fields decorated with accessor-context decorators, and disallow `accessor` on fields decorated with field-context decorators",
    },
    messages: {
      missingAccessorKeyword:
        "Property '{{name}}' is decorated with an accessor-context decorator but is missing the `accessor` keyword. Add `accessor` to the property declaration. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
      extraAccessorKeyword:
        "Property '{{name}}' uses the `accessor` keyword but is decorated with a field-context decorator. Remove `accessor` or use an accessor-context decorator instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"missingAccessorKeyword" | "extraAccessorKeyword", []>) {
    const accessorDecoratorNames = new Set<string>();
    const fieldDecoratorNames = new Set<string>();

    function analyzeDecoratorFunc(
      params: readonly TSESTree.Parameter[],
      name: string,
    ) {
      if (hasParamType(params, ACCESSOR_CONTEXT_TYPES)) {
        accessorDecoratorNames.add(name);
      } else if (hasParamType(params, FIELD_CONTEXT_TYPES)) {
        fieldDecoratorNames.add(name);
      }
    }

    function checkPropertyDecorators(
      node: TSESTree.PropertyDefinition | TSESTree.AccessorProperty,
      isAccessorField: boolean,
    ) {
      if (node.decorators.length === 0) return;

      let propName: string;
      if (node.key.type === "Identifier") {
        propName = node.key.name;
      } else if (node.key.type === "Literal") {
        propName = String(node.key.value);
      } else {
        propName = "";
      }

      let hasAccessorDeco = false;
      let hasFieldDeco = false;

      for (const deco of node.decorators) {
        const decoName = getDecoratorName(deco.expression);
        if (decoName === null) continue;
        if (accessorDecoratorNames.has(decoName)) hasAccessorDeco = true;
        if (fieldDecoratorNames.has(decoName)) hasFieldDeco = true;
      }

      if (hasAccessorDeco && !isAccessorField) {
        context.report({
          node,
          messageId: "missingAccessorKeyword",
          data: { name: propName },
        });
      } else if (hasFieldDeco && isAccessorField) {
        context.report({
          node,
          messageId: "extraAccessorKeyword",
          data: { name: propName },
        });
      }
    }

    return {
      FunctionDeclaration(node) {
        if (!node.id) return;
        const name = node.id.name;

        if (hasParamType(node.params, ACCESSOR_CONTEXT_TYPES)) {
          accessorDecoratorNames.add(name);
        } else if (hasParamType(node.params, FIELD_CONTEXT_TYPES)) {
          fieldDecoratorNames.add(name);
        } else {
          const returnedParams = findReturnedFunctionParams(node.body);
          if (returnedParams) {
            analyzeDecoratorFunc(returnedParams, name);
          }
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "FunctionExpression" ||
            node.init.type === "ArrowFunctionExpression")
        ) {
          const name = node.id.name;
          const params = node.init.params;

          if (hasParamType(params, ACCESSOR_CONTEXT_TYPES)) {
            accessorDecoratorNames.add(name);
          } else if (hasParamType(params, FIELD_CONTEXT_TYPES)) {
            fieldDecoratorNames.add(name);
          } else if (node.init.body.type === "BlockStatement") {
            const returnedParams = findReturnedFunctionParams(node.init.body);
            if (returnedParams) {
              analyzeDecoratorFunc(returnedParams, name);
            }
          }
        }
      },

      PropertyDefinition(node) {
        checkPropertyDecorators(node, false);
      },

      AccessorProperty(node) {
        checkPropertyDecorators(node, true);
      },
    };
  },
});
