import { TSESTree, ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import ts from "typescript";
import { createRule } from "../utils/rule-creator.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC19-serialization.md");

interface CheckedField {
  varName: string;
  propName: string;
}

function collectTypeChecks(node: TSESTree.Node): CheckedField[] {
  const results: CheckedField[] = [];
  walk(node, (n) => {
    if (n.type === "BinaryExpression") {
      const check = extractTypeCheck(n);
      if (check) results.push(check);
    }
  });
  return results;
}

function extractTypeCheck(node: TSESTree.Node): CheckedField | null {
  if (node.type !== "BinaryExpression") return null;

  return extractTypeofCheck(node) ?? extractInCheck(node) ?? null;
}

function extractTypeofCheck(node: TSESTree.BinaryExpression): CheckedField | null {
  if (
    !isTypeofMemberExpression(node)
  ) return null;

  const member = (node.left as TSESTree.UnaryExpression).argument as TSESTree.MemberExpression;
  const obj = member.object;
  const prop = member.property;

  if (
    obj.type === "Identifier" &&
    (prop.type === "Identifier" ||
      (prop.type === "Literal" && typeof prop.value === "string"))
  ) {
    return {
      varName: obj.name,
      propName: prop.type === "Identifier" ? prop.name : String(prop.value),
    };
  }

  return null;
}

function isTypeofMemberExpression(node: TSESTree.BinaryExpression): boolean {
  return (
    (node.operator === "===" || node.operator === "==") &&
    node.left?.type === "UnaryExpression" &&
    node.left.operator === "typeof" &&
    node.left.argument?.type === "MemberExpression"
  );
}

function extractInCheck(node: TSESTree.BinaryExpression): CheckedField | null {
  if (node.operator !== "in") return null;

  const left = node.left;
  const right = node.right;
  const propName = extractPropNameFromInLeft(left);

  if (propName && right.type === "Identifier") {
    return {
      varName: right.name,
      propName,
    };
  }

  return null;
}

function extractPropNameFromInLeft(
  node: TSESTree.Node
): string | null {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (
    node.type === "TemplateLiteral" &&
    node.quasis.length === 1 &&
    node.expressions.length === 0
  ) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

function getPropNamesFromType(ty: ts.Type): string[] {
  const props = ty.getProperties();
  return props.map((p) => String(p.escapedName));
}

export default createRule({
  name: "no-partial-validation",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow checking only some fields of an input at runtime while leaving other fields unvalidated. Use a schema validator instead.",
     },
    messages: {
      partialValidation:
        "Only {{checked}} of {{total}} properties are checked for '{{varName}}'. Use a schema validator to validate all fields instead of partial runtime checks. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"partialValidation", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    const checkTestExpression = (
      node: TSESTree.Node,
      test: TSESTree.Node | null | undefined,
    ) => {
      if (!test) return;

      const checks = collectTypeChecks(test);
      if (checks.length === 0) return;

      const checkedByVar = new Map<string, Set<string>>();
      for (const check of checks) {
        if (!checkedByVar.has(check.varName)) {
          checkedByVar.set(check.varName, new Set());
        }
        checkedByVar.get(check.varName)!.add(check.propName);
      }

      for (const [varName, checkedProps] of checkedByVar) {
        const varNode = findIdentifierInTree(test, varName);
        if (!varNode) continue;

        const tsNode =
          parserServices.esTreeNodeToTSNodeMap.get(varNode);
        if (!tsNode) continue;

        const varType = checker.getTypeAtLocation(tsNode as ts.Declaration);
        const allProps = getPropNamesFromType(varType);

        if (allProps.length === 0) continue;
        if (checkedProps.size >= allProps.length) continue;

        const checkedList = Array.from(checkedProps).join(", ");
        const total = allProps.length;

        context.report({
          node,
          messageId: "partialValidation",
          data: {
            varName,
            checked: checkedList,
            total: String(total),
            url: URL,
          },
        });
      }
    };

    return {
      IfStatement(node) {
        checkTestExpression(node, node.test);
      },
      WhileStatement(node) {
        checkTestExpression(node, node.test);
      },
      DoWhileStatement(node) {
        checkTestExpression(node, node.test);
      },
      ForStatement(node) {
        checkTestExpression(node, node.test);
      },
    };
  },
});

function findIdentifierInTree(root: TSESTree.Node, name: string): TSESTree.Identifier | null {
  let found: TSESTree.Identifier | null = null;
  walkNodes(root, (node) => {
    if (node.type === "Identifier" && node.name === name) {
      found = node;
      return true;
    }
    return false;
  });
  return found;
}
