import ts from "typescript";
import { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { createFunctionBodyVisitor } from "../utils/visitor-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  getComparisonInfo,
  findIfChainStarts,
  ComparisonInfo,
} from "../utils/ast-helpers.js";

const DOC_URL = knowledgeUrl("usecases/UC03-exhaustiveness.md");

function reportIfMissing(
  varName: string,
  tsVarNode: ts.Node,
  comparedValues: Set<string>,
  fallbackNode: TSESTree.Node,
  checker: ts.TypeChecker,
  context: Parameters<
    NonNullable<Parameters<typeof createRule>[0]["create"]>
  >[0],
): void {
  if (comparedValues.size < 2) return;

  const varType = checker.getTypeAtLocation(tsVarNode);
  const literalValues = new Set<string>();

  function collect(t: ts.Type) {
    if (t.isUnion()) {
      for (const member of t.types) collect(member);
      return;
    }
    if ((t.flags & ts.TypeFlags.StringLiteral) !== 0) {
      literalValues.add((t as ts.StringLiteralType).value);
    } else if ((t.flags & ts.TypeFlags.NumberLiteral) !== 0) {
      literalValues.add(String((t as ts.NumberLiteralType).value));
    } else if ((t.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
      literalValues.add(checker.typeToString(t));
    }
  }

  collect(varType);

  if (literalValues.size < 2) return;

  const missing = [...literalValues].filter((v) => !comparedValues.has(v));
  if (missing.length === 0) return;

  context.report({
    node: fallbackNode,
    messageId: "nonExhaustiveFallback",
    data: {
      varName,
      missing: missing.map((v) => `"${v}"`).join(", "),
      url: DOC_URL,
    },
  });
}

export default createRule({
  name: "prefer-switch-exhaustive-over-fallback-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Prefer switch with assertNever over if-else chain with fallback return on discriminated union values",
    },
    messages: {
      nonExhaustiveFallback:
        "If-else chain on union variable '{{varName}}' is missing cases: {{missing}}. Use a switch statement with assertNever in the default branch instead of a fallback return. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create: createFunctionBodyVisitor(
    (body, checker, esTreeNodeToTSNodeMap, context) => {
      function checkIfElseChain(
        ifStmt: TSESTree.IfStatement,
        firstInfo: ComparisonInfo,
        checker: ts.TypeChecker,
        context: Parameters<
          NonNullable<Parameters<typeof createRule>[0]["create"]>
        >[0],
      ): void {
        const comparedValues = new Set<string>();
        comparedValues.add(firstInfo.value);

        let current = ifStmt;

        while (current.alternate) {
          const alt = current.alternate;

          if (alt.type !== "IfStatement") {
            if (alt.type === "ReturnStatement" && comparedValues.size >= 2) {
              const fallback = alt.argument;
              if (fallback?.type === "Literal") {
                reportIfMissing(
                  firstInfo.varName,
                  firstInfo.tsVarNode,
                  comparedValues,
                  alt,
                  checker,
                  context,
                );
              }
            }
            break;
          }

          const nestedInfo = getComparisonInfo(alt.test, esTreeNodeToTSNodeMap);
          if (nestedInfo?.varName !== firstInfo.varName) {
            break;
          }

          comparedValues.add(nestedInfo.value);
          current = alt;
        }
      }

      findIfChainStarts(
        body.body,
        esTreeNodeToTSNodeMap,
        ({ ifStmt, info, consecutiveValues, nextIndex }) => {
          if (!ifStmt.alternate && consecutiveValues.size >= 2) {
            const nextStmt = body.body[nextIndex];
            if (nextStmt?.type === "ReturnStatement") {
              const fallback = nextStmt.argument;
              if (fallback?.type === "Literal") {
                reportIfMissing(
                  info.varName,
                  info.tsVarNode,
                  consecutiveValues,
                  nextStmt,
                  checker,
                  context,
                );
              }
            }
          }

          if (ifStmt.alternate) {
            checkIfElseChain(ifStmt, info, checker, context);
          }
        },
      );
    },
  ),
});
