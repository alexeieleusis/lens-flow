import ts from "typescript";
import { TSESTree } from "@typescript-eslint/utils";
import type { ParserServices } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { reportMissingValues } from "../utils/ts-helpers.js";
import { createFunctionBodyVisitor } from "../utils/visitor-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  getComparisonInfo,
  collectComparisonValues,
  findIfChainStarts,
  ComparisonInfo,
} from "../utils/ast-helpers.js";

const URL = knowledgeUrl("usecases/UC03-exhaustiveness.md");

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
  reportMissingValues(
    context,
    fallbackNode,
    checker,
    tsVarNode,
    varName,
    comparedValues,
    URL,
  );
}

function collectChainValues(
  ifStmt: TSESTree.IfStatement,
  firstInfo: ComparisonInfo,
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
): { handled: Set<string>; fallback: TSESTree.Statement | null } {
  let current: TSESTree.IfStatement = ifStmt;
  const handled = collectComparisonValues(firstInfo, () => {
    const alt = current.alternate;
    if (alt?.type !== "IfStatement") return null;
    current = alt;
    return getComparisonInfo(alt.test, esTreeNodeToTSNodeMap);
  });
  return { handled, fallback: current.alternate };
}

function reportFallbackIfMissing(
  fallback: TSESTree.Statement | null | undefined,
  varName: string,
  tsVarNode: ts.Node,
  handled: Set<string>,
  checker: ts.TypeChecker,
  context: Parameters<
    NonNullable<Parameters<typeof createRule>[0]["create"]>
  >[0],
): void {
  if (!fallback) return;

  let returnStmt: TSESTree.Node | null = null;
  if (fallback.type === "ReturnStatement") {
    returnStmt = fallback;
  } else if (fallback.type === "BlockStatement") {
    const lastStmt = fallback.body[fallback.body.length - 1];
    if (lastStmt?.type === "ReturnStatement") {
      returnStmt = lastStmt;
    }
  }

  if (returnStmt) {
    reportIfMissing(varName, tsVarNode, handled, returnStmt, checker, context);
  }
}

export default createRule({
  name: "require-exhaustive-if-chain-uc03",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require exhaustive if-else chains on discriminated union values — report unhandled variants in incomplete fallback",
    },
    messages: {
      nonExhaustiveFallback:
        "If-else chain on '{{varName}}' is missing cases: {{missing}}. The fallback silently handles unhandled variants. Use a switch with assertNever default instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create: createFunctionBodyVisitor(
    (body, checker, esTreeNodeToTSNodeMap, context) => {
      findIfChainStarts(
        body.body,
        esTreeNodeToTSNodeMap,
        ({ ifStmt, info, consecutiveValues: handled, nextIndex }) => {
          if (ifStmt.alternate) {
            const { handled: chainHandled, fallback } = collectChainValues(
              ifStmt,
              info,
              esTreeNodeToTSNodeMap,
            );

            reportFallbackIfMissing(
              fallback,
              info.varName,
              info.tsVarNode,
              chainHandled,
              checker,
              context,
            );
          } else {
            reportFallbackIfMissing(
              body.body[nextIndex] ?? null,
              info.varName,
              info.tsVarNode,
              handled,
              checker,
              context,
            );
          }
        },
      );
    },
  ),
});
