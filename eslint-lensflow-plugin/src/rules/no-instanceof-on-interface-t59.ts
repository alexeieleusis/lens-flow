import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const RULE_DOCS_URL = knowledgeUrl("catalog/T59-existential-types.md");

function isInterfaceType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol() || tsType.aliasSymbol;
  if (!symbol) return false;
  const decls = symbol.declarations || [];
  return decls.some((d): d is ts.InterfaceDeclaration =>
    ts.isInterfaceDeclaration(d),
  );
}

function typeContainsInterface(tsType: ts.Type): boolean {
  if (isInterfaceType(tsType)) return true;
  if ((tsType.flags & ts.TypeFlags.Union) !== 0) {
    const unionType = tsType as ts.UnionType;
    return unionType.types.some((member) => isInterfaceType(member));
  }
  return false;
}

export default createRule({
  name: "no-instanceof-on-interface-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using instanceof to check the concrete class of a variable typed as an interface.",
     },
    messages: {
      instanceofOnInterface:
        "Using instanceof to check the concrete class of a variable typed as an interface breaks existential encapsulation. Only call methods declared on the interface. See: " +
        RULE_DOCS_URL,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"instanceofOnInterface", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const checker = parserServices.program.getTypeChecker();

    return {
      BinaryExpression(node) {
        if (node.operator !== "instanceof") return;

        const leftType = checker.getTypeAtLocation(
          parserServices.esTreeNodeToTSNodeMap.get(node.left),
        );

        if (typeContainsInterface(leftType)) {
          context.report({
            node,
            messageId: "instanceofOnInterface",
          });
        }
      },
    };
  },
});
