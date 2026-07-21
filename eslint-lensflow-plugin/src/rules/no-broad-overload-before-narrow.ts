import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import type { FnLikeNode } from "../utils/overload-grouping.js";
import { createOverloadGroupVisitor } from "../utils/overload-grouping.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T22-callable-typing.md");

function isNarrowerType(
  checker: ts.TypeChecker,
  broadParams: ts.Type[],
  narrowParams: ts.Type[],
) {
  const len = Math.min(broadParams.length, narrowParams.length);
  for (let j = 0; j < len; j++) {
    const narrowToBroad = checker.isTypeAssignableTo(
      narrowParams[j],
      broadParams[j],
    );
    const broadToNarrow = checker.isTypeAssignableTo(
      broadParams[j],
      narrowParams[j],
    );
    if (narrowToBroad && !broadToNarrow) return true;
  }
  return false;
}

export default createRule({
  name: "no-broad-overload-before-narrow",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow broad overload signatures declared before narrower ones, making the narrow overload unreachable at call sites.",
    },
    messages: {
      broadBeforeNarrow:
        "Broad overload signature declared before narrow overload for `{{fnName}}`, making the narrow overload unreachable. Declare narrow overloads before broad ones. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"broadBeforeNarrow", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    type OverloadInfo = {
      node: FnLikeNode;
      tsParams: ts.Type[];
      pos: number;
    };

    const resolveSymbol = (impl: FnLikeNode): ts.Symbol | undefined => {
      if (impl.type === "FunctionDeclaration" && impl.id) {
        const tsId = parserServices.esTreeNodeToTSNodeMap.get(
          impl.id,
        ) as ts.Identifier;
        const sym = checker.getSymbolAtLocation(tsId);
        if (sym) return sym;
      }
      const tsImpl = parserServices.esTreeNodeToTSNodeMap.get(impl) as ts.Node;
      return checker.getSymbolAtLocation(tsImpl);
    };

    const collectOverloads = (
      all: FnLikeNode[],
      callSigs: readonly ts.Signature[],
    ): OverloadInfo[] => {
      const posMap = all.map((fn) => ({
        estree: fn,
        pos: (
          parserServices.esTreeNodeToTSNodeMap.get(fn) as ts.Node
        ).getStart(),
      }));

      const overloads: OverloadInfo[] = [];
      for (const sig of callSigs) {
        const decl = sig.getDeclaration();
        const declPos = decl.getStart();
        const match = posMap.find((p) => p.pos === declPos);
        if (!match) continue;

        const params = sig.getParameters();
        const tsParams = params.map((p) =>
          checker.getTypeOfSymbolAtLocation(
            p,
            (p.valueDeclaration ?? p) as ts.Node,
          ),
        );
        overloads.push({ node: match.estree, tsParams, pos: declPos });
      }
      return overloads;
    };

    const visitor = createOverloadGroupVisitor(({ all, impl }) => {
      if (all.length < 2) return;

      const name = impl.id?.type === "Identifier" ? impl.id.name : null;
      if (!name) return;

      const symbol = resolveSymbol(impl);
      if (!symbol) return;

      const fnType = checker.getTypeOfSymbolAtLocation(
        symbol,
        symbol.valueDeclaration!,
      );
      const callSigs = fnType.getCallSignatures();
      if (callSigs.length < 2) return;

      const overloads = collectOverloads(all, callSigs);
      overloads.sort((a, b) => a.pos - b.pos);
      if (overloads.length < 2) return;

      for (let i = 0; i < overloads.length - 1; i++) {
        if (
          isNarrowerType(
            checker,
            overloads[i].tsParams,
            overloads[i + 1].tsParams,
          )
        ) {
          context.report({
            node: overloads[i + 1].node,
            messageId: "broadBeforeNarrow",
            data: { fnName: name, url: URL },
          });
          break;
        }
      }
    });

    return visitor;
  },
});
