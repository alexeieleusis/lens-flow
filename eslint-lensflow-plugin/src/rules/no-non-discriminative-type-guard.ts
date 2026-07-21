import ts from "typescript";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T14-type-narrowing.md");

type TypeGuardCtx = {
  unionTypes: ts.Type[];
  checker: ts.TypeChecker;
};

type TypeGuardFunction =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

export default createRule({
  name: "no-non-discriminative-type-guard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using the 'in' operator to check a property that exists on all union members in a type guard function, which does not narrow the union type.",
    },
    messages: {
      nonDiscriminative:
        "The property '{{property}}' exists on all members of the union type, so '\"{{property}}\" in value' cannot distinguish union members. Use a property that uniquely identifies the target member. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nonDiscriminative", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    const typeGuardStack: TypeGuardCtx[] = [];
    let nonTypeGuardNestDepth = 0;

    function enterFunction(node: TypeGuardFunction) {
      const returnAnn = node.returnType?.typeAnnotation;
      const isTypeGuard = returnAnn?.type === "TSTypePredicate";

      if (!isTypeGuard) {
        nonTypeGuardNestDepth++;
        return;
      }
      if (node.params.length === 0) {
        nonTypeGuardNestDepth++;
        return;
      }

      const firstParam = node.params[0];
      const tsParam = parserServices.esTreeNodeToTSNodeMap.get(firstParam);
      if (!tsParam) {
        nonTypeGuardNestDepth++;
        return;
      }

      const paramTsType = checker.getTypeAtLocation(tsParam as ts.Node);
      const unionTypes =
        paramTsType.flags === ts.TypeFlags.Union
          ? (paramTsType as ts.UnionType).types
          : [paramTsType];

      if (unionTypes.length < 2) {
        nonTypeGuardNestDepth++;
        return;
      }

      typeGuardStack.push({ unionTypes, checker });
    }

    function leaveFunction() {
      if (nonTypeGuardNestDepth > 0) {
        nonTypeGuardNestDepth--;
      } else {
        typeGuardStack.pop();
      }
    }

    function checkInExpression(node: TSESTree.BinaryExpression) {
      if (node.operator !== "in") return;
      if (nonTypeGuardNestDepth > 0) return;
      const typeGuardCtx = typeGuardStack[typeGuardStack.length - 1];
      if (!typeGuardCtx) return;

      const left = node.left;
      let propertyName: string | undefined;

      if (left.type === "Literal" && typeof left.value === "string") {
        propertyName = left.value;
      } else if (
        left.type === "TemplateLiteral" &&
        left.quasis.length === 1 &&
        left.expressions.length === 0
      ) {
        propertyName = left.quasis[0].value.cooked ?? undefined;
      }

      if (!propertyName) return;

      const allHaveProperty = typeGuardCtx.unionTypes.every((memberType) => {
        const props = memberType.getProperties();
        return props.some((p) => p.escapedName === propertyName);
      });

      if (allHaveProperty) {
        context.report({
          node,
          messageId: "nonDiscriminative",
          data: { property: propertyName, url: URL },
        });
      }
    }

    return {
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": leaveFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": leaveFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": leaveFunction,
      BinaryExpression: checkInExpression,
    };
  },
});
