import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const DOCS_URL = knowledgeUrl("catalog/T33-self-type.md");

export default createRule({
  name: "require-type-predicate-subtype",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require that a `this is T` type predicate's `T` is a subtype of the enclosing class or interface type.",
    },
    messages: {
      notSubtype:
        "Type predicate `this is {{predicateType}}` is not a subtype of the enclosing type `{{enclosingType}}`. The predicate type must be assignable from the enclosing type. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"notSubtype", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkTypePredicate(node: TSESTree.Node & { returnType?: TSESTree.TSTypeAnnotation }) {
      const returnAnn = node.returnType?.typeAnnotation;
      if (returnAnn?.type !== "TSTypePredicate") return;

      const pred = returnAnn;
      const paramNameNode = pred.parameterName;
      if (paramNameNode.type !== "TSThisType") return;

      const tsPredNode =
        parserServices.esTreeNodeToTSNodeMap.get(pred);
      if (!tsPredNode) return;

      const tsTypeNode = tsPredNode.type;
      if (!tsTypeNode) return;

      const predicateType = checker.getTypeAtLocation(tsTypeNode);
      const predicateTypeStr = checker.typeToString(predicateType);

      let enclosingType: ts.Type | undefined;

      const ancestor = context.sourceCode
        .getAncestors(node)
        .reverse()
        .find(
          (a) =>
            a.type === "ClassDeclaration" ||
            a.type === "ClassExpression" ||
            a.type === "TSInterfaceDeclaration",
        );

      if (!ancestor) return;

      const tsAncestor =
        parserServices.esTreeNodeToTSNodeMap.get(ancestor);
      if (!tsAncestor) return;

      if (ts.isClassDeclaration(tsAncestor) || ts.isClassExpression(tsAncestor)) {
        const classLike = tsAncestor as ts.ClassLikeDeclaration;
        if (classLike.name) {
          const classSym = checker.getSymbolAtLocation(classLike.name);
          if (classSym) {
            enclosingType = checker.getDeclaredTypeOfSymbol(classSym);
          }
        }
      } else if (ts.isInterfaceDeclaration(tsAncestor)) {
        const ifaceSym = checker.getSymbolAtLocation(tsAncestor.name);
        if (ifaceSym) {
          enclosingType = checker.getDeclaredTypeOfSymbol(ifaceSym);
        }
      }
      if (!enclosingType) return;

      const enclosingTypeStr = checker.typeToString(enclosingType);

      function isSubtype(pred: ts.Type, enc: ts.Type): boolean {
        if (checker.isTypeAssignableTo(pred, enc)) return true;
        const encName = enc.symbol?.escapedName as string;
        try {
          const bases = checker.getBaseTypes(pred as ts.InterfaceType);
          for (const base of bases) {
            if (base === enc || (base.symbol?.escapedName as string) === encName || isSubtype(base, enc)) return true;
          }
        } catch { /* no base types */ }
        return false;
      }

      if (!isSubtype(predicateType, enclosingType)) {
        context.report({
          node: pred,
          messageId: "notSubtype",
          data: {
            predicateType: predicateTypeStr,
            enclosingType: enclosingTypeStr,
            url: DOCS_URL,
          },
        });
      }
    }

    const handler = (node: TSESTree.Node & { returnType?: TSESTree.TSTypeAnnotation }) => checkTypePredicate(node);

    return {
      TSMethodSignature: handler,
      TSFunctionType: handler,
      MethodDefinition(node: TSESTree.MethodDefinition) {
        handler(node.value);
      },
      FunctionDeclaration: handler,
      FunctionExpression(node: TSESTree.FunctionExpression) {
        if (node.parent?.type === "MethodDefinition") return;
        handler(node);
      },
      ArrowFunctionExpression: handler,
      TSEmptyBodyFunctionExpression: handler,
      TSDeclareFunction: handler,
    };
  },
});
