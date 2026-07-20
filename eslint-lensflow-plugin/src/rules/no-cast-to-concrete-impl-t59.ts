import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T59-existential-types.md");

function isInterfaceType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol() || tsType.aliasSymbol;
  if (!symbol) return false;
  const decls = symbol.declarations || [];
  return decls.some((d): d is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(d),
  );
}

function classImplementsInterface(
  classDecl: ts.ClassDeclaration,
  sourceType: ts.Type,
  checker: ts.TypeChecker,
  visited: Set<ts.Symbol>,
): boolean {
  if (!classDecl.name) return false;
  const symbol = checker.getSymbolAtLocation(classDecl.name);
  if (!symbol) return false;
  if (visited.has(symbol)) return false;
  visited.add(symbol);

  const heritageClauses = classDecl.heritageClauses || [];

  // Check direct implements
  const implementsClause = heritageClauses.find(
    (hc) => hc.token === ts.SyntaxKind.ImplementsKeyword,
  );
  if (implementsClause) {
    const match = implementsClause.types.some((expr) => {
      const implementedType = checker.getTypeAtLocation(expr);
      return checker.isTypeAssignableTo(sourceType, implementedType);
    });
    if (match) return true;
  }

  // Recursively check parent class via extends
  const extendsClause = heritageClauses.find(
    (hc) => hc.token === ts.SyntaxKind.ExtendsKeyword,
  );
  if (extendsClause && extendsClause.types.length > 0) {
    const parentType = checker.getTypeAtLocation(extendsClause.types[0]);
    const parentSymbol = parentType.getSymbol();
    if (parentSymbol) {
      const parentClass = parentSymbol.declarations?.find(
        (d): d is ts.ClassDeclaration => ts.isClassDeclaration(d),
      );
      if (parentClass && classImplementsInterface(parentClass, sourceType, checker, visited)) {
        return true;
      }
    }
  }

  return false;
}

export default createRule({
  name: "no-cast-to-concrete-impl-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow casting an interface-typed value to a concrete implementing class, which bypasses the existential abstraction.",
    },
    messages: {
      castToConcreteImpl:
        "Casting an interface-typed value to a concrete implementing class bypasses the existential abstraction. Only use members declared on the interface. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"castToConcreteImpl", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      TSAsExpression(node) {
        const sourceType = parserServices.getTypeAtLocation(node.expression);

        if (!isInterfaceType(sourceType)) return;

        const targetType = parserServices.getTypeAtLocation(node.typeAnnotation);
        const targetSymbol = targetType.getSymbol() || targetType.aliasSymbol;

        if (!targetSymbol) return;

        const classDecl = targetSymbol.declarations?.find(
          (d): d is ts.ClassDeclaration => ts.isClassDeclaration(d),
        );
        if (!classDecl) return;

        const implementsInterface = classImplementsInterface(
          classDecl,
          sourceType,
          checker,
          new Set(),
        );
        if (!implementsInterface) return;

        context.report({
          node,
          messageId: "castToConcreteImpl",
          data: { url: URL },
        });
      },
    };
  },
});
