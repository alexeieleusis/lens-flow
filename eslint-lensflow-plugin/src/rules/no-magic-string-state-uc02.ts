import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC02-domain-modeling.md");

type Comparison = {
  node: TSESTree.BinaryExpression;
  variableName: string;
  value: string;
};

type Scope = {
  comparisons: Comparison[];
  switches: TSESTree.SwitchStatement[];
};

function normalizeVariable(
  node: TSESTree.Identifier | TSESTree.MemberExpression,
): string {
  if (node.type === "Identifier") {
    return node.name;
  }
  const objName =
    node.object.type === "Identifier" || node.object.type === "MemberExpression"
      ? normalizeVariable(node.object as TSESTree.Identifier | TSESTree.MemberExpression)
      : undefined;
  if (!objName) return "?";
  const prop =
    node.property.type === "Identifier" ? node.property.name : "?";
  return objName + "." + prop;
}

function getSwitchVariable(
  sw: TSESTree.SwitchStatement,
): string {
  if (
    sw.discriminant.type === "Identifier" ||
    sw.discriminant.type === "MemberExpression"
  ) {
    return normalizeVariable(
      sw.discriminant as TSESTree.Identifier | TSESTree.MemberExpression,
    );
  }
  return "?";
}

function groupComparisons(
  comparisons: Comparison[],
): Map<string, Comparison[]> {
  const groups = new Map<string, Comparison[]>();
  for (const comp of comparisons) {
    const existing = groups.get(comp.variableName);
    if (existing) {
      existing.push(comp);
    } else {
      groups.set(comp.variableName, [comp]);
    }
  }
  return groups;
}

export default createRule({
  name: "no-magic-string-state-uc02",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow magic string comparisons on the same variable — use a literal union type instead",
    },
    messages: {
      magicComparison:
        "Variable '{{variable}}' compared against multiple magic string literals ({{values}}). Use a literal union type for compile-time exhaustiveness. See: {{url}}",
      magicSwitch:
        "Switch on '{{variable}}' with multiple magic string cases. Use a literal union type for compile-time exhaustiveness. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"magicComparison" | "magicSwitch", []>) {
    const scopeStack: Scope[] = [];

    function getCurrentScope(): Scope | null {
      return scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;
    }

    function enterScope(): void {
      scopeStack.push({ comparisons: [], switches: [] });
    }

    function reportMagicComparisons(
      groups: Map<string, Comparison[]>,
    ): void {
      for (const [, groupComps] of groups) {
        const distinctValues = new Set(groupComps.map((c) => c.value));
        if (distinctValues.size >= 2) {
          for (const comp of groupComps) {
            context.report({
              node: comp.node,
              messageId: "magicComparison",
              data: {
                variable: comp.variableName,
                values: [...distinctValues].join(", "),
                url: URL,
              },
            });
          }
        }
      }
    }

    function reportMagicSwitches(
      switches: TSESTree.SwitchStatement[],
    ): void {
      for (const sw of switches) {
        const stringCases = sw.cases.filter(
          (c) =>
            c.test?.type === "Literal" &&
            typeof (c.test as TSESTree.Literal).value === "string",
        );
        if (stringCases.length >= 2) {
          context.report({
            node: sw,
            messageId: "magicSwitch",
            data: { variable: getSwitchVariable(sw), url: URL },
          });
        }
      }
    }

    function exitScope(): void {
      const scope = scopeStack.pop();
      if (!scope) return;

      const groups = groupComparisons(scope.comparisons);
      reportMagicComparisons(groups);
      reportMagicSwitches(scope.switches);
    }

    return {
      FunctionDeclaration: enterScope,
      "FunctionDeclaration:exit": exitScope,
      FunctionExpression: enterScope,
      "FunctionExpression:exit": exitScope,
      ArrowFunctionExpression: enterScope,
      "ArrowFunctionExpression:exit": exitScope,

      BinaryExpression(node) {
        const scope = getCurrentScope();
        if (!scope) return;

        if (
          node.operator !== "===" &&
          node.operator !== "==" &&
          node.operator !== "!==" &&
          node.operator !== "!="
        ) {
          return;
        }

        const leftIsStringLiteral =
          node.left.type === "Literal" &&
          typeof (node.left as TSESTree.Literal).value === "string";
        const rightIsStringLiteral =
          node.right.type === "Literal" &&
          typeof (node.right as TSESTree.Literal).value === "string";
        const leftIsVar =
          node.left.type === "Identifier" ||
          node.left.type === "MemberExpression";
        const rightIsVar =
          node.right.type === "Identifier" ||
          node.right.type === "MemberExpression";

        if (
          !(leftIsStringLiteral && rightIsVar) &&
          !(rightIsStringLiteral && leftIsVar)
        ) {
          return;
        }

        let nonLiteral: TSESTree.Identifier | TSESTree.MemberExpression;
        let literal: TSESTree.Literal;

        if (leftIsStringLiteral) {
          literal = node.left as TSESTree.Literal;
          nonLiteral = node.right as
            | TSESTree.Identifier
            | TSESTree.MemberExpression;
        } else {
          literal = node.right as TSESTree.Literal;
          nonLiteral = node.left as
            | TSESTree.Identifier
            | TSESTree.MemberExpression;
        }

        scope.comparisons.push({
          node,
          variableName: normalizeVariable(nonLiteral),
          value: String(literal.value),
        });
      },

      SwitchStatement(node) {
        const scope = getCurrentScope();
        if (!scope) return;

        const isVarDiscriminant =
          node.discriminant.type === "Identifier" ||
          node.discriminant.type === "MemberExpression";
        if (!isVarDiscriminant) return;

        scope.switches.push(node);
      },
    };
  },
});
