import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
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
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function checkTypePredicate(node: any) {
      const returnAnn = node.returnType?.typeAnnotation;
      if (returnAnn?.type !== "TSTypePredicate") return;

      const pred = returnAnn;
      const paramNameNode = pred.parameterName;
      if (paramNameNode.type !== "TSThisType") return;

      const tsPredNode =
        parserServices.esTreeNodeToTSNodeMap.get(pred);
      if (!tsPredNode) return;

      const tsTypeNode = (tsPredNode as ts.TypePredicateNode).type;
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

      enclosingType = checker.getTypeAtLocation(tsAncestor as ts.Node);
      if (!enclosingType) return;

      const enclosingTypeStr = checker.typeToString(enclosingType);

      if (!checker.isTypeAssignableTo(predicateType, enclosingType)) {
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

    const handler = (node: any) => checkTypePredicate(node);

    return {
      TSMethodSignature: handler,
      TSFunctionType: handler,
      MethodDefinition(node: any) {
        handler(node.value);
      },
      FunctionDeclaration: handler,
      FunctionExpression: handler,
      ArrowFunctionExpression: handler,
      TSEmptyBodyFunctionExpression: handler,
      TSDeclareFunction: handler,
    };
  },
});
