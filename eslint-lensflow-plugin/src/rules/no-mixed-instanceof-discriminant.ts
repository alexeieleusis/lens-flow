import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T01-algebraic-data-types.md";

function isClassType(tsType: ts.Type): boolean {
  const symbol = tsType.getSymbol() || tsType.aliasSymbol;
  if (!symbol) return false;
  const decls = symbol.declarations || [];
  return decls.some((d): d is ts.ClassDeclaration => ts.isClassDeclaration(d));
}

export default createRule({
  name: "no-mixed-instanceof-discriminant",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow discriminated unions that mix class types (instanceof narrowing) with plain object literal types (discriminant narrowing).",
     },
    messages: {
      mixed:
        "This union mixes class types (narrowed via instanceof) with plain object types (narrowed via discriminant literal). Use a consistent narrowing strategy — either all class types or all literal-discriminant types. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mixed", []>) {
    const parserServices = ESLintUtils.getParserServices(context, { allowNoProject: true });
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    function hasLiteralDiscriminant(tsType: ts.Type): boolean {
      const props = tsType.getProperties();
      for (const prop of props) {
        const decl = prop.valueDeclaration;
        if (!decl) continue;
        const propType = checker.getTypeOfSymbolAtLocation(prop, decl);
        const isLiteral =
          (propType.flags & ts.TypeFlags.StringLiteral) !== 0 ||
          (propType.flags & ts.TypeFlags.NumberLiteral) !== 0 ||
          (propType.flags & ts.TypeFlags.BooleanLiteral) !== 0;
        if (isLiteral) return true;
      }
      return false;
    }

    return {
      TSTypeAliasDeclaration(node) {
        if (node.typeAnnotation.type !== "TSUnionType") return;

        const unionNode = node.typeAnnotation;
        const members = unionNode.types;

        if (members.length < 2) return;

        let hasClassMember = false;
        let hasLiteralObjectMember = false;

        for (const member of members) {
          const tsNode = parserServices.esTreeNodeToTSNodeMap.get(member);
          if (!tsNode) continue;

          const memberTsType = checker.getTypeFromTypeNode(tsNode as ts.TypeNode);

          if (isClassType(memberTsType)) {
            hasClassMember = true;
          } else if (memberTsType.isObject() && hasLiteralDiscriminant(memberTsType)) {
            hasLiteralObjectMember = true;
          }
        }

        if (hasClassMember && hasLiteralObjectMember) {
          context.report({
            node,
            messageId: "mixed",
            data: { url: URL },
          });
        }
      },
    };
  },
});
