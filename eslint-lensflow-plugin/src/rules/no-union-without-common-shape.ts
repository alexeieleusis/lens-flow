import ts from "typescript";
import { ESLintUtils, type TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T02-union-intersection.md");

const PRIMITIVE_TYPE_FLAGS =
  ts.TypeFlags.Any |
  ts.TypeFlags.Unknown |
  ts.TypeFlags.Never |
  ts.TypeFlags.String |
  ts.TypeFlags.Number |
  ts.TypeFlags.Boolean |
  ts.TypeFlags.ESSymbol |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.Null |
  ts.TypeFlags.Void;

function extractPropsFromLiteral(
  literal: import("@typescript-eslint/types").TSESTree.TSTypeLiteral,
): Set<string> {
  const names = new Set<string>();
  for (const m of literal.members) {
    if (m.type === "TSPropertySignature" || m.type === "TSMethodSignature") {
      if (m.key.type === "Identifier") {
        names.add(m.key.name);
      } else if (m.key.type === "Literal" && typeof m.key.value === "string") {
        names.add(m.key.value);
      }
    }
  }
  return names;
}

function gatherPropertySets(
  unionNode: import("@typescript-eslint/types").TSESTree.TSUnionType,
  checker: ts.TypeChecker,
  parserServices: ReturnType<typeof ESLintUtils.getParserServices>,
): Set<string>[] {
  const propertySets: Set<string>[] = [];

  for (const member of unionNode.types) {
    const tsNode = parserServices.esTreeNodeToTSNodeMap.get(member);
    if (!tsNode) continue;

    const memberType = checker.getTypeAtLocation(tsNode);

    if ((memberType.flags & PRIMITIVE_TYPE_FLAGS) !== 0) {
      continue;
    }

    const props = checker.getPropertiesOfType(memberType);
    const names = new Set(props.map((p) => p.getName()));

    if (names.size > 0) {
      propertySets.push(names);
    }
  }

  return propertySets;
}

export default createRule({
  name: "no-union-without-common-shape",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow union types whose inline type literal members share no common properties",
    },
    messages: {
      noCommonShape:
        "Union members share no common properties, so no property is safely accessible without narrowing. Add a common discriminant or restructure the union. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"noCommonShape", []>) {
    let parserServices: ReturnType<typeof ESLintUtils.getParserServices> | null =
      null;
    let checker: ts.TypeChecker | null = null;

    try {
      parserServices = ESLintUtils.getParserServices(context);
      const program = parserServices.program;
      if (program) {
        checker = program.getTypeChecker();
      }
    } catch {
      // No type information available
    }

    return {
      TSUnionType(node) {
        const propertySets =
          checker && parserServices
            ? gatherPropertySets(node, checker, parserServices)
            : node.types
                  .filter(
                    (m): m is import("@typescript-eslint/types").TSESTree.TSTypeLiteral =>
                      m.type === "TSTypeLiteral",
                  )
                  .map(extractPropsFromLiteral);

        if (propertySets.length < 2) return;

        const intersection = propertySets.reduce<Set<string>>(
          (acc, set) => new Set([...acc].filter((x) => set.has(x))),
          propertySets[0],
        );

        if (intersection.size === 0) {
          context.report({
            node,
            messageId: "noCommonShape",
            data: { url: URL },
          });
        }
      },
    };
  },
});
