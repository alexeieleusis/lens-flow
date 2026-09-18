import ts from "typescript";
import { TSESTree, TSESLint, ESLintUtils } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { getStringLiteralUnionValues } from "../utils/ts-helpers.js";

const URL = knowledgeUrl(
  "usecases/UC02-domain-modeling.md",
  "Antipattern 3 — Magic strings for states",
);

type Comparison = {
  node: TSESTree.BinaryExpression;
  variableName: string;
  value: string;
};

type Scope = {
  comparisons: Comparison[];
  switches: TSESTree.SwitchStatement[];
  guard: GuardInfo | null;
  literalUnionCache: Map<string, boolean>;
};

// A user-defined type guard (`function f(x: unknown): x is T`) whose asserted
// type `T` is a string-literal union. Comparisons of `x` against `T`'s own
// literals inside such a function are the validation itself, not a magic-string
// antipattern.
type GuardInfo = {
  paramName: string;
  values: Set<string>;
};

type FunctionLike =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function normalizeVariable(
  node: TSESTree.Identifier | TSESTree.MemberExpression,
): string {
  if (node.type === "Identifier") {
    return node.name;
  }
  const objName =
    node.object.type === "Identifier" || node.object.type === "MemberExpression"
      ? normalizeVariable(
          node.object as TSESTree.Identifier | TSESTree.MemberExpression,
        )
      : undefined;
  if (!objName) return "?";
  const prop =
    !node.computed && node.property.type === "Identifier"
      ? node.property.name
      : node.computed &&
          node.property.type === "Literal" &&
          typeof node.property.value === "string"
        ? node.property.value
        : "?";
  return objName + "." + prop;
}

function getSwitchVariable(sw: TSESTree.SwitchStatement): string {
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

// True when every leaf of an `||` tree is an equality comparison of
// `variableName` against a string literal — i.e. the whole disjunction is
// "is variableName one of these literals", not something a different
// variable could satisfy on its own.
function everyDisjunctComparesVariable(
  node: TSESTree.Node,
  variableName: string,
): boolean {
  if (node.type === "LogicalExpression" && node.operator === "||") {
    return (
      everyDisjunctComparesVariable(node.left, variableName) &&
      everyDisjunctComparesVariable(node.right, variableName)
    );
  }

  if (node.type !== "BinaryExpression") return false;
  if (
    node.operator !== "===" &&
    node.operator !== "==" &&
    node.operator !== "!==" &&
    node.operator !== "!="
  ) {
    return false;
  }

  const leftIsVar =
    node.left.type === "Identifier" || node.left.type === "MemberExpression";
  const rightIsVar =
    node.right.type === "Identifier" || node.right.type === "MemberExpression";
  const leftIsStringLiteral =
    node.left.type === "Literal" &&
    typeof (node.left as TSESTree.Literal).value === "string";
  const rightIsStringLiteral =
    node.right.type === "Literal" &&
    typeof (node.right as TSESTree.Literal).value === "string";

  if (leftIsStringLiteral && rightIsVar) {
    return (
      normalizeVariable(
        node.right as TSESTree.Identifier | TSESTree.MemberExpression,
      ) === variableName
    );
  }
  if (rightIsStringLiteral && leftIsVar) {
    return (
      normalizeVariable(
        node.left as TSESTree.Identifier | TSESTree.MemberExpression,
      ) === variableName
    );
  }
  return false;
}

// True for `x === "a" || x === "b" ? x : fallback` — every comparison in
// the disjunction narrows `x` and the ternary then returns that same `x`.
// This is a validate-and-pass-through idiom, not state-branching on magic
// strings. A disjunction where some operand compares a different variable
// (`x === "a" || y === "b" ? x : fallback`) does NOT qualify: `y` alone
// can satisfy the condition without validating `x`, so `x` can still be a
// magic-string state check.
function isValuePreservingTernary(
  node: TSESTree.BinaryExpression,
  variableName: string,
): boolean {
  let current: TSESTree.Node = node;
  while (
    current.parent?.type === "LogicalExpression" &&
    current.parent.operator === "||"
  ) {
    current = current.parent;
  }

  const parent = current.parent;
  if (parent?.type !== "ConditionalExpression" || parent.test !== current) {
    return false;
  }

  if (!everyDisjunctComparesVariable(current, variableName)) {
    return false;
  }

  const consequent = parent.consequent;
  return (
    (consequent.type === "Identifier" ||
      consequent.type === "MemberExpression") &&
    normalizeVariable(consequent) === variableName
  );
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
    const parserServices = ESLintUtils.getParserServices(context, true);
    const checker = parserServices.program?.getTypeChecker();

    const scopeStack: Scope[] = [];

    function getCurrentScope(): Scope | null {
      return scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;
    }

    // If `node` is `function f(x: unknown): x is T` and `T` resolves to a
    // string-literal union, returns that guard's parameter name and literals.
    function getGuardInfo(node: FunctionLike): GuardInfo | null {
      if (!checker) return null;

      const returnAnn = node.returnType?.typeAnnotation;
      if (returnAnn?.type !== "TSTypePredicate" || !returnAnn.typeAnnotation) {
        return null;
      }
      if (returnAnn.parameterName.type !== "Identifier") return null;

      const tsTypeNode = parserServices.esTreeNodeToTSNodeMap.get(
        returnAnn.typeAnnotation.typeAnnotation,
      );
      if (!tsTypeNode) return null;

      const assertedType = checker.getTypeFromTypeNode(
        tsTypeNode as ts.TypeNode,
      );
      const values = getStringLiteralUnionValues(assertedType, checker);
      if (values.length < 2) return null;

      return {
        paramName: returnAnn.parameterName.name,
        values: new Set(values),
      };
    }

    // True when `variableName`'s TypeScript type is already a string-literal
    // union (e.g. a declared `type OrderState = "pending" | "shipped"`), in
    // which case the comparisons are consuming an existing union type, not a
    // magic-string antipattern that needs one introduced. Cached per variable
    // per scope since a variable's type doesn't change between the many
    // comparisons/switches a scope can hold against it.
    function computeIsLiteralUnionType(
      node: TSESTree.Identifier | TSESTree.MemberExpression,
    ): boolean {
      if (!checker) return false;

      const tsNode = parserServices.esTreeNodeToTSNodeMap.get(node);
      if (!tsNode) return false;

      return (
        getStringLiteralUnionValues(checker.getTypeAtLocation(tsNode), checker)
          .length >= 2
      );
    }

    function isAlreadyLiteralUnionType(
      scope: Scope,
      variableName: string,
      node: TSESTree.Identifier | TSESTree.MemberExpression,
    ): boolean {
      // "?" marks a segment normalizeVariable couldn't resolve statically
      // (e.g. a dynamically-computed member `o[x]`) — distinct members can
      // collapse to the same ambiguous name, so caching by that name would
      // let one member's result leak onto another's.
      if (variableName === "?" || variableName.endsWith(".?")) {
        return computeIsLiteralUnionType(node);
      }

      const cached = scope.literalUnionCache.get(variableName);
      if (cached !== undefined) return cached;

      const result = computeIsLiteralUnionType(node);
      scope.literalUnionCache.set(variableName, result);
      return result;
    }

    function enterScope(node: FunctionLike): void {
      scopeStack.push({
        comparisons: [],
        switches: [],
        guard: getGuardInfo(node),
        literalUnionCache: new Map(),
      });
    }

    function reportMagicComparisons(groups: Map<string, Comparison[]>): void {
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

    function reportMagicSwitches(switches: TSESTree.SwitchStatement[]): void {
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
            TSESTree.Identifier | TSESTree.MemberExpression;
        } else {
          literal = node.right as TSESTree.Literal;
          nonLiteral = node.left as
            TSESTree.Identifier | TSESTree.MemberExpression;
        }

        const variableName = normalizeVariable(nonLiteral);
        const value = String(literal.value);

        if (
          scope.guard?.paramName === variableName &&
          scope.guard.values.has(value)
        ) {
          return;
        }
        if (isValuePreservingTernary(node, variableName)) {
          return;
        }
        if (isAlreadyLiteralUnionType(scope, variableName, nonLiteral)) {
          return;
        }

        scope.comparisons.push({ node, variableName, value });
      },

      SwitchStatement(node) {
        const scope = getCurrentScope();
        if (!scope) return;

        const isVarDiscriminant =
          node.discriminant.type === "Identifier" ||
          node.discriminant.type === "MemberExpression";
        if (!isVarDiscriminant) return;

        const discriminant = node.discriminant as
          TSESTree.Identifier | TSESTree.MemberExpression;
        const variableName = getSwitchVariable(node);

        if (scope.guard?.paramName === variableName) return;
        if (isAlreadyLiteralUnionType(scope, variableName, discriminant))
          return;

        scope.switches.push(node);
      },
    };
  },
});
