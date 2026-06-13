import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function isClassDecoratorContextParam(param: TSESTree.Parameter): boolean {
  const inner = param.type === "TSParameterProperty" ? param.parameter : param;
  if (!inner.typeAnnotation) return false;
  const typeAnn = inner.typeAnnotation.typeAnnotation;
  if (typeAnn.type === "TSTypeReference") {
    const typeNode = typeAnn.typeName;
    if (typeNode.type === "Identifier" && typeNode.name === "ClassDecoratorContext") {
      return true;
    }
    if (
      typeNode.type === "TSQualifiedName" &&
      typeNode.right.name === "ClassDecoratorContext"
    ) {
      return true;
    }
  }
  return false;
}

function extractDefinePropertyCalls(
  node: TSESTree.CallExpression,
): string[] | null {
  const { callee } = node;
  if (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Object" &&
    callee.property.type === "Identifier" &&
    (callee.property.name === "defineProperty" ||
      callee.property.name === "defineProperties")
  ) {
    if (callee.property.name === "defineProperty") {
      const propArg = node.arguments[1];
      if (
        propArg?.type === "Literal" &&
        typeof propArg.value === "string"
      ) {
        return [propArg.value];
      }
      if (propArg?.type === "Identifier") {
        return [propArg.name];
      }
    } else {
      const descArg = node.arguments[1];
      if (descArg?.type === "ObjectExpression") {
        const names: string[] = [];
        for (const prop of descArg.properties) {
          if (prop.type === "Property") {
            if (prop.key.type === "Identifier" && !prop.computed) {
              names.push(prop.key.name);
            } else if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
              names.push(prop.key.value);
            }
          }
        }
        if (names.length > 0) return names;
      }
    }
  }
  return null;
}

function getDecoratorFuncName(
  expression: TSESTree.Expression,
): string | null {
  if (expression.type === "Identifier") {
    return expression.name;
  }
  if (
    expression.type === "CallExpression" &&
    expression.callee.type === "Identifier"
  ) {
    return expression.callee.name;
  }
  return null;
}

function getClassDeclaredProperties(body: TSESTree.ClassBody): Set<string> {
  const declared = new Set<string>();
  for (const member of body.body) {
    if (member.type === "PropertyDefinition" && member.key.type === "Identifier") {
      declared.add(member.key.name);
    }
    if (
      member.type === "TSAbstractPropertyDefinition" &&
      member.key.type === "Identifier"
    ) {
      declared.add(member.key.name);
    }
  }
  return declared;
}

export default createRule({
  name: "no-decorator-modifies-inferred-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow class decorators that add properties via Object.defineProperty invisible to TypeScript",
    },
    messages: {
      decoratorModifiesInferredType:
        "Decorator adds property '{{property}}' via Object.defineProperty that TypeScript cannot infer. Declare the property on the class instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
      decoratorModifiesMultipleProperties:
        "Decorator adds properties {{properties}} via Object.defineProperty that TypeScript cannot infer. Declare them on the class instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"decoratorModifiesInferredType" | "decoratorModifiesMultipleProperties", []>) {
    const decoratorFuncProps = new Map<string, Set<string>>();
    const decoratorFuncStack: string[] = [];
    const decoratedClasses: TSESTree.ClassDeclaration[] = [];

    function enterDecoratorFunc(name: string) {
      decoratorFuncStack.push(name);
      decoratorFuncProps.set(name, new Set());
    }

    function exitDecoratorFunc() {
      decoratorFuncStack.pop();
    }

    function reportUndeclaredProperties(
      decorator: TSESTree.Decorator,
      undeclared: string[],
    ) {
      context.report({
        node: decorator,
        messageId:
          undeclared.length === 1
            ? "decoratorModifiesInferredType"
            : "decoratorModifiesMultipleProperties",
        data: {
          property: undeclared[0],
          properties: `"${undeclared.join('", "')}"`,
        },
      });
    }

    function checkClassDecorators(
      classNode: TSESTree.ClassDeclaration,
    ) {
      const declaredProperties = getClassDeclaredProperties(classNode.body);

      for (const decorator of classNode.decorators) {
        const funcName = getDecoratorFuncName(decorator.expression);
        if (funcName == null || !decoratorFuncProps.has(funcName)) {
          continue;
        }

        const definedProps = decoratorFuncProps.get(funcName)!;
        const undeclared = [...definedProps].filter(
          (p) => !declaredProperties.has(p),
        );

        if (undeclared.length > 0) {
          reportUndeclaredProperties(decorator, undeclared);
        }
      }
    }

    return {
      ClassDeclaration(node) {
        if (node.decorators != null && node.decorators.length > 0) {
          decoratedClasses.push(node);
        }
      },

      FunctionDeclaration(node) {
        if (node.params.some(isClassDecoratorContextParam) && node.id) {
          enterDecoratorFunc(node.id.name);
        }
      },

      "FunctionDeclaration:exit"(node) {
        if (
          node.params.some(isClassDecoratorContextParam) &&
          node.id
        ) {
          exitDecoratorFunc();
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== "Identifier" || !node.init) return;
        if (
          (node.init.type === "ArrowFunctionExpression" ||
            node.init.type === "FunctionExpression") &&
          node.init.params.some(isClassDecoratorContextParam)
        ) {
          enterDecoratorFunc(node.id.name);
        }
      },

      "VariableDeclarator:exit"(node) {
        if (node.id.type !== "Identifier" || !node.init) return;
        if (
          (node.init.type === "ArrowFunctionExpression" ||
            node.init.type === "FunctionExpression") &&
          node.init.params.some(isClassDecoratorContextParam)
        ) {
          exitDecoratorFunc();
        }
      },

      CallExpression(node) {
        if (decoratorFuncStack.length === 0) return;
        const currentName = decoratorFuncStack[decoratorFuncStack.length - 1];
        const propNames = extractDefinePropertyCalls(node);
        if (propNames) {
          const props = decoratorFuncProps.get(currentName)!;
          for (const name of propNames) props.add(name);
        }
      },

      "Program:exit"() {
        for (const classNode of decoratedClasses) {
          checkClassDecorators(classNode);
        }
      },
    };
  },
});
