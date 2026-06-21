import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md";

function isInterfaceType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol() || tsType.aliasSymbol;
  if (!symbol) return false;
  const decls = symbol.declarations || [];
  return decls.some((d): d is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(d),
  );
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
        "Casting an interface-typed value to a concrete implementing class bypasses the existential abstraction. Only use members declared on the interface. See: " +
        URL,
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

        const heritageClauses = classDecl.heritageClauses || [];
        const implementsClause = heritageClauses.find(
          (hc) => hc.token === ts.SyntaxKind.ImplementsKeyword,
        );
        if (!implementsClause) return;

        const implementsInterface = implementsClause.types.some((expr) => {
          const implementedType = checker.getTypeAtLocation(expr);
          return checker.isTypeAssignableTo(sourceType, implementedType);
        });

        if (!implementsInterface) return;

        context.report({
          node,
          messageId: "castToConcreteImpl",
        });
      },
    };
  },
});
