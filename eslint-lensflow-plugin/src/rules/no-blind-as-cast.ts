import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const RULE_URL = knowledgeUrl("catalog/T18-conversions-coercions.md");

const untrustedCallNames = new Set([
  "JSON.parse",
  "fetch",
  "XMLHttpRequest",
  "readFileSync",
  "readFile",
  "prompt",
]);

function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
  if (node.type === "AwaitExpression") return unwrapExpression(node.argument);
  if (node.type === "ChainExpression") return unwrapExpression(node.expression);
  if (node.type === "TSNonNullExpression") return unwrapExpression(node.expression);
  return node;
}

function getUntrustedCallNameFromExpression(
  node: TSESTree.Node,
): string | null {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type !== "CallExpression") return null;

  const callee = unwrapped.callee;
  if (callee.type === "Identifier") {
    if (untrustedCallNames.has(callee.name)) return callee.name;
    return null;
  }
  if (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.property.type === "Identifier"
  ) {
    const fullName = `${callee.object.name}.${callee.property.name}`;
    if (untrustedCallNames.has(fullName)) return fullName;
    if (untrustedCallNames.has(callee.property.name)) return callee.property.name;
    return null;
  }
  return null;
}

function getUntrustedCallName(
  node: TSESTree.Node,
  sourceCode: TSESLint.SourceCode,
): string | null {
  // First check the expression directly
  const direct = getUntrustedCallNameFromExpression(node);
  if (direct) return direct;

  // If it's an identifier, trace to its declaration initializer
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type === "Identifier") {
    const scope = sourceCode.getScope
      ? sourceCode.getScope(unwrapped)
      : null;
    if (scope) {
      const variable = scope.set.get(unwrapped.name);
      if (variable && variable.defs.length > 0) {
        const def = variable.defs[0];
        if (
          def.node.type === "VariableDeclarator" &&
          def.node.init
        ) {
          return getUntrustedCallNameFromExpression(def.node.init);
        }
      }
    }
  }

  return null;
}

export default createRule({
  name: "no-blind-as-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow blind `as T` casts on untrusted data (unknown, any, JSON.parse, fetch results) without runtime validation.",
    },
    messages: {
      blindCast:
        "Blind `as {{targetType}}` cast on a value of type `{{sourceType}}`. Use a runtime type guard or schema validator instead of a bare cast. See: {{url}}",
      blindCastUntrusted:
        "Blind `as {{targetType}}` cast on untrusted data from `{{callName}}`. Use a runtime type guard or schema validator instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"blindCastUntrusted" | "blindCast", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const sourceCode = context.sourceCode;

    return {
      TSAsExpression(node) {
        const exprTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.expression);
        if (!exprTs) return;

        const exprType = checker.getTypeAtLocation(
          exprTs as ts.Expression,
        );
        const sourceTypeStr = checker.typeToString(exprType);

        const typeNodeTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
        if (!typeNodeTs) return;

        const targetType = checker.getTypeFromTypeNode(
          typeNodeTs as ts.TypeNode,
        );
        const targetTypeStr = checker.typeToString(targetType);

        if (["unknown", "any", "never"].includes(targetTypeStr)) return;

        if (["unknown", "any"].includes(sourceTypeStr)) {
          const callName = getUntrustedCallName(node.expression, sourceCode);
          if (callName) {
            context.report({
              node,
              messageId: "blindCastUntrusted",
              data: { targetType: targetTypeStr, callName, url: RULE_URL },
            });
          } else {
            context.report({
              node,
              messageId: "blindCast",
              data: {
                targetType: targetTypeStr,
                sourceType: sourceTypeStr,
                url: RULE_URL,
              },
            });
          }
          return;
        }

        const untrustedCall = getUntrustedCallName(node.expression, sourceCode);
        if (untrustedCall) {
          context.report({
            node,
            messageId: "blindCastUntrusted",
            data: {
              targetType: targetTypeStr,
              callName: untrustedCall,
              url: RULE_URL,
            },
          });
        }
      },
    };
  },
});
