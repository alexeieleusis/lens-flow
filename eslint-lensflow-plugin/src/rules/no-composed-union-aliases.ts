import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "catalog/T02-union-intersection.md",
  "Antipatterns When Using It > Union: Union of Unions Without Discriminant",
);

function isLiteralDiscriminant(type: ts.Type): boolean {
  const literalFlags =
    ts.TypeFlags.StringLiteral |
    ts.TypeFlags.NumberLiteral |
    ts.TypeFlags.BooleanLiteral;
  return (type.flags & literalFlags) !== 0;
}

export default createRule({
  name: "no-composed-union-aliases",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow type aliases that compose union aliases whose sub-union members lack a common discriminant field, preventing narrowing with a single check.",
    },
    messages: {
      composed:
        "Type alias '{{name}}' composes union aliases whose members lack a common discriminant field{{discriminants}}. Use a shared discriminant so a single check can narrow the whole union. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"composed", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};
    const checker = program.getTypeChecker();

    function getLiteralDiscriminantProps(t: ts.Type): string[] {
      const props = t.getProperties();
      const result: string[] = [];
      for (const prop of props) {
        const propName = prop.getName();
        const propType = checker.getTypeOfSymbol(prop);
        if (isLiteralDiscriminant(propType)) {
          result.push(propName);
        }
      }
      return result;
    }

    function findCommonDiscriminants(types: ts.Type[]): string[] {
      if (types.length === 0) return [];
      const objectTypes = types.filter(
        (t) => (t.flags & ts.TypeFlags.Object) !== 0,
      );
      if (objectTypes.length === 0) return [];
      let common = getLiteralDiscriminantProps(objectTypes[0]);
      for (let i = 1; i < objectTypes.length; i++) {
        const props = getLiteralDiscriminantProps(objectTypes[i]);
        common = common.filter((p) => props.includes(p));
        if (common.length === 0) break;
      }
      return common;
    }

    function isUnionAlias(
      member: TSESTree.TypeNode,
      precomputedType?: ts.Type,
    ): boolean {
      if (member.type === "TSUnionType") {
        return member.types.some((inner) => isUnionAlias(inner));
      }
      if (member.type !== "TSTypeReference") return false;
      if (precomputedType) {
        return (precomputedType.flags & ts.TypeFlags.Union) !== 0;
      }
      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(member);
      if (!tsNode) return false;
      const memberTsType = checker.getTypeAtLocation(tsNode);
      return (memberTsType.flags & ts.TypeFlags.Union) !== 0;
    }

    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSUnionType") return;

        const unionNode = node.typeAnnotation;
        const members = unionNode.types;

        if (members.length < 2) return;

        let hasUnionAlias = false;
        const allSubTypes: ts.Type[] = [];
        for (const member of members) {
          const tsNode = parserServices.esTreeNodeToTSNodeMap.get(member);
          if (!tsNode) continue;
          const memberTsType = checker.getTypeAtLocation(tsNode);
          if (isUnionAlias(member, memberTsType)) hasUnionAlias = true;
          if ((memberTsType.flags & ts.TypeFlags.Union) === 0) {
            allSubTypes.push(memberTsType);
          } else {
            allSubTypes.push(...(memberTsType as ts.UnionType).types);
          }
        }
        if (!hasUnionAlias) return;

        const commonDiscriminants = findCommonDiscriminants(allSubTypes);
        if (commonDiscriminants.length > 0) return;

        context.report({
          node,
          messageId: "composed",
          data: {
            name: node.id.name,
            url: URL,
            discriminants: "",
          },
        });
      },
    };
  },
});
