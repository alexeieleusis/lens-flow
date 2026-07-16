import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

type FunctionLikeNode =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression
  | TSESTree.TSDeclareFunction
  | TSESTree.TSFunctionType
  | TSESTree.TSCallSignatureDeclaration
  | TSESTree.TSMethodSignature;

function getParamName(
  param: TSESTree.Parameter,
  sourceCode: TSESLint.SourceCode,
): string {
  if (param.type === "TSParameterProperty") {
    return getParamName(param.parameter, sourceCode);
  }
  if (param.type === "AssignmentPattern") {
    if (param.left.type === "Identifier") return param.left.name;
    if (
      param.left.type === "ObjectPattern" ||
      param.left.type === "ArrayPattern"
    ) {
      return sourceCode.getText(param.left);
    }
    return "unnamed";
  }
  if (param.type === "Identifier") {
    return param.name;
  }
  if (param.type === "RestElement") {
    if (param.argument.type === "Identifier") return param.argument.name;
    if (
      param.argument.type === "ObjectPattern" ||
      param.argument.type === "ArrayPattern"
    ) {
      return sourceCode.getText(param.argument);
    }
    return "unnamed";
  }
  if (param.type === "ObjectPattern" || param.type === "ArrayPattern") {
    return sourceCode.getText(param);
  }
  return sourceCode.getText(param);
}

function isParamAny(param: TSESTree.Parameter): boolean {
  if (param.type === "TSParameterProperty") {
    return isParamAny(param.parameter);
  }
  if (param.type === "AssignmentPattern") {
    return param.left.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  if (param.type === "Identifier") {
    return param.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  if (
    param.type === "RestElement" ||
    param.type === "ObjectPattern" ||
    param.type === "ArrayPattern"
  ) {
    return param.typeAnnotation?.typeAnnotation.type === "TSAnyKeyword";
  }
  return false;
}

function isStandalone(node: TSESTree.Node): boolean {
  const parent = node.parent;
  if (!parent) return false;

  // Top-level: `function foo() {}` or `export function foo() {}`
  if (parent.type === "Program" || parent.type === "ExportNamedDeclaration") {
    return true;
  }

  // Top-level default: `export default function foo() {}`
  if (parent.type === "ExportDefaultDeclaration") {
    return true;
  }

  // `const foo = function() {}` / `const foo = () => {}`
  if (parent.type === "VariableDeclarator") {
    const decl = parent.parent;
    if (decl?.type === "VariableDeclaration") {
      const scope = decl.parent;
      return (
        scope?.type === "Program" ||
        scope?.type === "ExportNamedDeclaration" ||
        scope?.type === "ExportDefaultDeclaration"
      );
    }
  }

  // Top-level type alias: `type Foo = (x: any) => any`
  if (parent.type === "TSTypeAliasDeclaration") {
    const scope = parent.parent;
    return (
      scope?.type === "Program" ||
      scope?.type === "ExportNamedDeclaration" ||
      scope?.type === "ExportDefaultDeclaration"
    );
  }

  // Inside top-level interface: `interface Foo { (x: any): any; bar(): any; }`
  if (parent.type === "TSInterfaceBody") {
    const iface = parent.parent;
    if (iface?.type === "TSInterfaceDeclaration") {
      const scope = iface.parent;
      return (
        scope?.type === "Program" ||
        scope?.type === "ExportNamedDeclaration" ||
        scope?.type === "ExportDefaultDeclaration"
      );
    }
  }

  return false;
}

export default createRule({
  name: "no-any-in-utility-function",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `any` in standalone utility function parameter or return types when a generic could preserve type safety",
    },
    messages: {
      anyParam:
        "Utility function uses `any` for parameter '{{name}}'. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
      anyReturn:
        "Utility function uses `any` for return type. Use a generic type parameter to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T04-generics-bounds.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyParam" | "anyReturn", []>) {
    function checkFunction(node: FunctionLikeNode) {
      if (!isStandalone(node)) {
        return;
      }

      for (const param of node.params) {
        if (isParamAny(param)) {
          context.report({
            node: param,
            messageId: "anyParam",
            data: { name: getParamName(param, context.sourceCode) },
          });
        }
      }

      if (node.returnType?.typeAnnotation.type === "TSAnyKeyword") {
        context.report({
          node: node.returnType.typeAnnotation,
          messageId: "anyReturn",
        });
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      TSDeclareFunction: checkFunction,
      TSFunctionType: checkFunction,
      TSCallSignatureDeclaration: checkFunction,
      TSMethodSignature: checkFunction,
    };
  },
});
