import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T07-structural-typing.md");

function getObjectLiteralProps(obj: TSESTree.ObjectExpression): string[] {
  return obj.properties
    .filter((p): p is TSESTree.Property => p.type === "Property")
    .filter(
      (p) =>
        !p.computed &&
        (p.key.type === "Identifier" || p.key.type === "Literal"),
    )
    .map((p) => {
      if (p.key.type === "Identifier") return p.key.name;
      const lit = p.key as TSESTree.Literal;
      if (typeof lit.value === "string") return lit.value;
      return String(lit.value);
    });
}

function unwrap(node: TSESTree.Node): TSESTree.Expression {
  if (
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "ChainExpression"
  ) {
    return unwrap(node.expression);
  }
  return node as TSESTree.Expression;
}

function findObjectLiteral(
  expr: TSESTree.Expression,
  context: Parameters<NonNullable<Parameters<typeof createRule>[0]["create"]>>[0],
): TSESTree.ObjectExpression | null {
  if (expr.type === "ObjectExpression") return expr;

  if (expr.type === "Identifier") {
    const scope = context.sourceCode.getScope(expr);
    const variable = scope?.set.get(expr.name);
    if (variable && variable.defs.length > 0) {
      const def = variable.defs[0];
      if (
        def.node.type === "VariableDeclarator" &&
        def.node.init?.type === "ObjectExpression"
      ) {
        // If the variable has an explicit type annotation, the `as` is
        // intentional narrowing — not a bypass.
        if (
          def.node.id.type === "Identifier" &&
          def.node.id.typeAnnotation
        ) {
          return null;
        }
        return def.node.init;
      }
    }
  }

  return null;
}

export default createRule({
  name: "no-assertion-bypass",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow using `as` to bypass excess property checks on object literals. Use `satisfies` or fix the type mismatch instead.",
    },
    messages: {
      excessProps:
        "Using `as {{targetType}}` to silently bypass excess property check(s): {{excessProps}}. Use `satisfies {{targetType}}` or remove the excess property. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"excessProps", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        const typeNodeTs =
          parserServices.esTreeNodeToTSNodeMap.get(node.typeAnnotation);
        if (!typeNodeTs) return;

        const targetType = checker.getTypeFromTypeNode(
          typeNodeTs as ts.TypeNode,
        );

        // Types with index signatures (e.g., { [key: string]: unknown }) allow
        // arbitrary properties, so there's no excess property to report.
        if (checker.getIndexInfosOfType(targetType).length > 0) return;

        const targetPropNames = new Set(
          checker.getPropertiesOfType(targetType).map(
            (p) => p.escapedName as string,
          ),
        );

        const objLit = findObjectLiteral(unwrap(node.expression), context);
        if (!objLit) return;

        const literalProps = getObjectLiteralProps(objLit);
        const excessProps = literalProps.filter(
          (name) => !targetPropNames.has(name),
        );

        if (excessProps.length > 0) {
          context.report({
            node,
            messageId: "excessProps",
            data: {
              targetType: checker.typeToString(targetType),
              excessProps: excessProps.map((p) => `"${p}"`).join(", "),
              url: URL,
            },
          });
        }
      },
    };
  },
});
