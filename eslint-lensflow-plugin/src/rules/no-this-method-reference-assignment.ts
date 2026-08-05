import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "catalog/T33-self-type.md",
  "Annotating with a base-class function type discards `this`",
);

function typeNodeHasThisReturnType(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSThisType") return true;
  if (typeNode.type === "TSUnionType") {
    return typeNode.types.some(typeNodeHasThisReturnType);
  }
  if (typeNode.type === "TSIntersectionType") {
    return typeNode.types.some(typeNodeHasThisReturnType);
  }
  return false;
}

function extractClassMethods(
  node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
): {
  className: string | null;
  methodsWithThis: Set<string>;
  superClassName: string | null;
} {
  const className =
    (node.type === "ClassDeclaration" ? node.id?.name : null) ?? null;
  const superClassName =
    (node.superClass?.type === "Identifier" ? node.superClass.name : null) ??
    null;

  const methodsWithThis = new Set<string>();
  for (const member of node.body.body) {
    if (
      (member.type === "MethodDefinition" ||
        member.type === "TSAbstractMethodDefinition") &&
      member.key.type === "Identifier"
    ) {
      const returnType =
        member.type === "TSAbstractMethodDefinition"
          ? (
              member as TSESTree.TSAbstractMethodDefinition & {
                returnType?: TSESTree.TSTypeAnnotation;
              }
            ).returnType
          : member.value?.returnType;
      if (returnType && typeNodeHasThisReturnType(returnType.typeAnnotation)) {
        methodsWithThis.add(member.key.name);
      }
    }
  }
  return { className, methodsWithThis, superClassName };
}

export default createRule({
  name: "no-this-method-reference-assignment",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow assigning a method reference that returns `this` to a variable with an explicit type annotation, which collapses the polymorphic `this` to the base class type and breaks fluent chains on subclasses.",
    },
    messages: {
      methodRefAssignment:
        "Method reference `{{methodName}}` that returns `this` is being stored with an explicit type annotation on `{{varName}}`, collapsing the polymorphic `this`. Let the type infer, or call the method directly. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"methodRefAssignment", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    const classInfo = new Map<
      string,
      { methodsWithThis: Set<string>; superClassName: string | null }
    >();
    const variableToClass = new Map<string, string>();

    function visitClass(
      node: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
    ) {
      const {
        className: explicitName,
        methodsWithThis,
        superClassName,
      } = extractClassMethods(node);
      let className = explicitName;
      if (!className && node.type === "ClassExpression" && node.parent) {
        const parent = node.parent;
        if (
          parent.type === "VariableDeclarator" &&
          parent.id.type === "Identifier"
        ) {
          className = parent.id.name;
        }
      }
      if (!className) return;
      classInfo.set(className, { methodsWithThis, superClassName });

      if (node.type === "ClassExpression" && node.parent) {
        const parent = node.parent;
        if (
          parent.type === "VariableDeclarator" &&
          parent.id.type === "Identifier" &&
          parent.init === node
        ) {
          variableToClass.set(parent.id.name, className);
        }
      }
    }

    function classHasMethodWithThisReturn(
      className: string,
      methodName: string,
    ): boolean {
      const info = classInfo.get(className);
      if (!info) return false;
      if (info.methodsWithThis.has(methodName)) return true;
      if (info.superClassName) {
        return classHasMethodWithThisReturn(info.superClassName, methodName);
      }
      return false;
    }

    function resolveClassName(base: ts.Expression): string | null {
      const baseType = checker.getApparentType(checker.getTypeAtLocation(base));
      if (baseType.flags & ts.TypeFlags.Object) {
        const sym = baseType.getSymbol();
        if (sym) return checker.symbolToString(sym);
      }
      return null;
    }

    function resolveClassNameFromAST(
      baseExpr: TSESTree.Expression,
    ): string | null {
      if (baseExpr.type !== "Identifier") return null;
      const varName = baseExpr.name;
      const ancestors = context.sourceCode.getAncestors(baseExpr);
      for (const ancestor of ancestors) {
        if (
          ancestor.type === "VariableDeclarator" &&
          ancestor.id === baseExpr
        ) {
          if (ancestor.init?.type === "NewExpression") {
            const callee = ancestor.init.callee;
            if (callee.type === "Identifier") {
              return callee.name;
            }
          }
          break;
        }
        if (
          ancestor.type === "Program" ||
          ancestor.type === "FunctionDeclaration" ||
          ancestor.type === "FunctionExpression" ||
          ancestor.type === "ArrowFunctionExpression"
        ) {
          break;
        }
      }

      const className = variableToClass.get(varName);
      if (className) return className;
      return null;
    }

    function hasExplicitTypeAnnotation(
      node: TSESTree.VariableDeclarator | TSESTree.AssignmentExpression,
    ): boolean {
      if (node.type === "VariableDeclarator") {
        return node.id.typeAnnotation !== undefined;
      }
      if (node.type === "AssignmentExpression" && node.left.type === "Identifier") {
        const leftTsNode = esTreeNodeToTSNodeMap.get(node.left);
        if (!leftTsNode || !ts.isIdentifier(leftTsNode)) return false;
        const decls = checker.getSymbolAtLocation(leftTsNode)?.declarations;
        if (!decls) return false;
        for (const decl of decls) {
          if (ts.isVariableDeclaration(decl) && decl.type !== undefined) {
            return true;
          }
        }
      }
      if (
        node.type === "AssignmentExpression" &&
        node.left.type === "MemberExpression"
      ) {
        const leftTsNode = esTreeNodeToTSNodeMap.get(node.left);
        if (
          !leftTsNode ||
          !ts.isPropertyAccessExpression(leftTsNode) ||
          !leftTsNode.name
        )
          return false;
        const propSym = checker.getSymbolAtLocation(leftTsNode.name);
        const decls = propSym?.declarations;
        if (!decls) return false;
        for (const decl of decls) {
          if (
            (ts.isPropertyDeclaration(decl) || ts.isPropertySignature(decl)) &&
            (decl as ts.PropertyDeclaration | ts.PropertySignature).type !==
              undefined
          ) {
            return true;
          }
        }
      }
      return false;
    }

    function checkAssignment(
      node: TSESTree.VariableDeclarator | TSESTree.AssignmentExpression,
    ) {
      const init = node.type === "VariableDeclarator" ? node.init : node.right;
      if (init?.type !== "MemberExpression") return;

      const member = init;
      const memberTsNode = esTreeNodeToTSNodeMap.get(member);
      if (!memberTsNode || !ts.isPropertyAccessExpression(memberTsNode)) return;

      if (!memberTsNode.name) return;
      const methodName = (memberTsNode.name as ts.Identifier).text;
      const baseTsNode = memberTsNode.expression as ts.Expression;

      let className = resolveClassName(baseTsNode);
      if (!className) {
        className = resolveClassNameFromAST(member.object);
      }
      if (!className) return;

      if (!classHasMethodWithThisReturn(className, methodName)) return;

      if (!hasExplicitTypeAnnotation(node)) return;

      let varName: string;
      if (node.type === "VariableDeclarator" && node.id.type === "Identifier") {
        varName = node.id.name;
      } else if (
        node.type === "AssignmentExpression" &&
        node.left.type === "Identifier"
      ) {
        varName = node.left.name;
      } else if (
        node.type === "AssignmentExpression" &&
        node.left.type === "MemberExpression"
      ) {
        const parts: string[] = [];
        let current: TSESTree.Node = node.left;
        while (current.type === "MemberExpression") {
          if (current.property.type === "Identifier") {
            parts.unshift(current.property.name);
          }
          current = current.object;
        }
        if (current.type === "Identifier") {
          parts.unshift(current.name);
        }
        varName = parts.join(".");
      } else {
        varName = "?";
      }

      context.report({
        node: member,
        messageId: "methodRefAssignment",
        data: { methodName, varName, url: URL },
      });
    }

    return {
      ClassDeclaration: visitClass,
      ClassExpression: visitClass,
      VariableDeclarator: checkAssignment,
      AssignmentExpression: checkAssignment,
    };
  },
});
