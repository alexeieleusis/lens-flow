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

function extractTemplateLiteralValue(node: TSESTree.TemplateLiteral): string | null {
  if (node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }
  return null;
}

function extractKeyname(key: TSESTree.Expression): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "TemplateLiteral") return extractTemplateLiteralValue(key);
  return null;
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
      const propArg = node.arguments[1] as TSESTree.Expression | undefined;
      const name = propArg ? extractKeyname(propArg) : null;
      if (name !== null) return [name];
    } else {
      const descArg = node.arguments[1];
      if (descArg?.type === "ObjectExpression") {
        const names: string[] = [];
        for (const prop of descArg.properties) {
          if (prop.type === "Property") {
            const name = extractKeyname(prop.key);
            if (name !== null) names.push(name);
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

function keyToString(key: TSESTree.Expression | TSESTree.PrivateIdentifier): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "Literal" && typeof key.value === "number") return String(key.value);
  if (key.type === "PrivateIdentifier") return `#${key.name}`;
  return null;
}

function hasKey(
  member: TSESTree.ClassElement,
): member is TSESTree.PropertyDefinition |
  TSESTree.TSAbstractPropertyDefinition |
  TSESTree.AccessorProperty |
  TSESTree.MethodDefinition |
  TSESTree.TSAbstractMethodDefinition {
  return [
    "PropertyDefinition", "TSAbstractPropertyDefinition", "AccessorProperty",
    "MethodDefinition", "TSAbstractMethodDefinition",
  ].includes(member.type);
}

function isPropertyLike(
  member: TSESTree.ClassElement,
): member is TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition | TSESTree.AccessorProperty {
  return (
    member.type === "PropertyDefinition" ||
    member.type === "TSAbstractPropertyDefinition" ||
    member.type === "AccessorProperty"
  );
}

function isMethodLike(
  member: TSESTree.ClassElement,
): member is TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition {
  return (
    member.type === "MethodDefinition" ||
    member.type === "TSAbstractMethodDefinition"
  );
}

function isConstructorParamProperty(
  param: TSESTree.Parameter,
): param is TSESTree.TSParameterProperty & { parameter: TSESTree.Identifier } {
  return (
    param.type === "TSParameterProperty" &&
    param.parameter.type === "Identifier"
  );
}

function getClassDeclaredProperties(body: TSESTree.ClassBody): Set<string> {
  const declared = new Set<string>();
  for (const member of body.body) {
    if (!hasKey(member)) continue;
    const name = keyToString(member.key);
    if (name === null) continue;

    if (isPropertyLike(member)) {
      declared.add(name);
    }

    if (isMethodLike(member) && member.kind === "constructor" && member.value) {
      declared.add(name);
      for (const param of member.value.params) {
        if (isConstructorParamProperty(param)) {
          declared.add(param.parameter.name);
        }
      }
    }

    if (isMethodLike(member) && member.kind === "method") {
      declared.add(name);
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
        "Disallow class decorators that add properties via Object.defineProperty invisible to TypeScript. Note: Only inline literal, identifier, and template-literal keys are detected. Object.defineProperties with a variable reference for the properties argument is not analyzed.",
    },
    messages: {
      decoratorModifiesInferredType:
        "Decorator adds property '{{property}}' via Object.defineProperty that TypeScript cannot infer. Declare the property on the class instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
      decoratorModifiesMultipleProperties:
        "Decorator adds properties {{properties}} via Object.defineProperty that TypeScript cannot infer. Declare them on the class instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T17-macros-metaprogramming.md",
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
