import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T14-type-narrowing.md";

type TypeGuardCtx = {
  unionTypes: ts.Type[];
  checker: ts.TypeChecker;
};

export default createRule({
  name: "no-non-discriminative-type-guard",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using the 'in' operator to check a property that exists on all union members in a type guard function, which makes the guard always true and unable to narrow.",
     },
    messages: {
      nonDiscriminative:
        "The property '{{property}}' exists on all members of the union type, so '\"{{property}}\" in value' is always true and cannot narrow the type. Use a property that uniquely identifies the target member. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nonDiscriminative", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    let typeGuardCtx: TypeGuardCtx | null = null;

    function enterTypeGuard(node: { returnType?: any; params: any[] }) {
      const returnAnn = node.returnType?.typeAnnotation;
      if (returnAnn?.type !== "TSTypePredicate") return;
      if (node.params.length === 0) return;

      const firstParam = node.params[0];
      const tsParam = parserServices.esTreeNodeToTSNodeMap.get(firstParam);
      if (!tsParam) return;

      const paramTsType = checker.getTypeAtLocation(tsParam as ts.Node);
      const unionTypes = (paramTsType as ts.UnionType).types ?? [paramTsType];

      if (unionTypes.length < 2) return;

      typeGuardCtx = { unionTypes, checker };
    }

    function leaveTypeGuard() {
      typeGuardCtx = null;
    }

    function checkInExpression(node: any) {
      if (node.operator !== "in") return;
      if (!typeGuardCtx) return;

      const left = node.left;
      let propertyName: string | undefined;

      if (
        left.type === "Literal" &&
        typeof left.value === "string"
      ) {
        propertyName = left.value;
      } else if (
        left.type === "TemplateLiteral" &&
        left.quasis.length === 1 &&
        left.expressions.length === 0
      ) {
        propertyName = left.quasis[0].value.cooked;
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

    const fnEnter = (node: any) => enterTypeGuard(node);
    const fnLeave = () => leaveTypeGuard();

    return {
      FunctionDeclaration: fnEnter,
      "FunctionDeclaration:exit": fnLeave,
      FunctionExpression: fnEnter,
      "FunctionExpression:exit": fnLeave,
      ArrowFunctionExpression: fnEnter,
      "ArrowFunctionExpression:exit": fnLeave,
      BinaryExpression: checkInExpression,
    };
  },
});
