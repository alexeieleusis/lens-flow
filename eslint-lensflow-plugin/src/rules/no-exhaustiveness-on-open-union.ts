import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walkNodes } from "../utils/ast-helpers.js";

const DOCS_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T14-type-narrowing.md";

function hasNeverCast(stmt: TSESTree.Statement): boolean {
  return walkNodes(
    stmt,
    (node) =>
      node.type === "TSAsExpression" &&
      node.typeAnnotation.type === "TSNeverKeyword",
  );
}

function hasExhaustivenessCheck(consequent: TSESTree.Statement[]): boolean {
  for (const stmt of consequent) {
    if (stmt.type === "EmptyStatement") continue;
    if (stmt.type === "ThrowStatement") return true;
    if (hasNeverCast(stmt)) return true;
  }
  return false;
}

function isBroadType(tsType: ts.Type): boolean {
  const flags = tsType.flags;
  return (
    (flags & ts.TypeFlags.String) !== 0 ||
    (flags & ts.TypeFlags.Number) !== 0 ||
    (flags & ts.TypeFlags.Boolean) !== 0
  );
}

function typeAnnotationIsOpenUnion(
  typeAnn: TSESTree.TypeNode | undefined,
): boolean {
  if (typeAnn?.type !== "TSUnionType") return false;

  let hasLiteral = false;
  let hasBroad = false;

  for (const member of typeAnn.types) {
    if (
      member.type === "TSLiteralType" &&
      member.literal.type === "Literal"
    ) {
      hasLiteral = true;
    }
    if (
      member.type === "TSStringKeyword" ||
      member.type === "TSNumberKeyword" ||
      member.type === "TSBooleanKeyword"
    ) {
      hasBroad = true;
    }
  }

  return hasLiteral && hasBroad;
}

function isFunctionNode(node: TSESTree.Node): node is TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

function paramHasBinding(
  fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
  paramName: string,
): boolean {
  for (const param of fn.params) {
    if (param.type === "Identifier" && param.name === paramName) return true;
    if (
      param.type === "AssignmentPattern" &&
      param.left.type === "Identifier" &&
      param.left.name === paramName
    )
      return true;
  }
  return false;
}

function findTypeInFunctionParams(
  fn: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression,
  paramName: string,
): TSESTree.TypeNode | undefined {
  for (const param of fn.params) {
    if (param.type === "Identifier" && param.name === paramName) {
      return (
        (param as TSESTree.Identifier & {
          typeAnnotation?: TSESTree.TSTypeAnnotation;
        }).typeAnnotation?.typeAnnotation
      );
    }
    if (
      param.type === "AssignmentPattern" &&
      param.left.type === "Identifier" &&
      param.left.name === paramName
    ) {
      return (
        (param.left as TSESTree.Identifier & {
          typeAnnotation?: TSESTree.TSTypeAnnotation;
        }).typeAnnotation?.typeAnnotation
      );
    }
  }
  return undefined;
}

function varDeclHasBinding(
  decl: TSESTree.VariableDeclaration,
  varName: string,
): boolean {
  return decl.declarations.some(
    (d) => d.id.type === "Identifier" && d.id.name === varName,
  );
}

function findTypeInVariableDeclaration(
  decl: TSESTree.VariableDeclaration,
  varName: string,
): TSESTree.TypeNode | undefined {
  for (const d of decl.declarations) {
    if (d.id.type === "Identifier" && d.id.name === varName) {
      return d.id.typeAnnotation?.typeAnnotation;
    }
  }
  return undefined;
}

function findParamTypeAnnotation(
  discriminant: TSESTree.Expression,
  switchNode: TSESTree.SwitchStatement,
  sourceCode: TSESLint.SourceCode,
): TSESTree.TypeNode | undefined {
  if (discriminant.type !== "Identifier") return undefined;

  const name = discriminant.name;
  const ancestors = sourceCode.getAncestors(switchNode);

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];

    if (isFunctionNode(current)) {
      if (paramHasBinding(current, name)) {
        return findTypeInFunctionParams(current, name);
      }
    }

    if (current.type === "VariableDeclaration") {
      if (varDeclHasBinding(current as TSESTree.VariableDeclaration, name)) {
        return findTypeInVariableDeclaration(
          current as TSESTree.VariableDeclaration,
          name,
        );
      }
    }
  }

  return undefined;
}

export default createRule({
  name: "no-exhaustiveness-on-open-union",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exhaustiveness checks (throw / as never) in the default branch when the discriminant type is an open union that includes a broad base type like string",
     },
    messages: {
      openUnion:
        "This switch discriminant type is an open union (contains both literals and a broad type like string). The default branch will receive valid arbitrary values — do not use an exhaustiveness check (throw or as never) here. Use a fallback instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"openUnion", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      SwitchStatement(node) {
        const tsDiscriminant =
          parserServices.esTreeNodeToTSNodeMap.get(node.discriminant);
        if (!tsDiscriminant) return;

        const discriminantType = checker.getTypeAtLocation(tsDiscriminant);

        const broad = isBroadType(discriminantType);
        if (!broad) return;

        const typeAnn = findParamTypeAnnotation(
          node.discriminant,
          node,
          context.sourceCode,
        );

        const openUnion = typeAnnotationIsOpenUnion(typeAnn);

        if (!openUnion) return;

        const defaultCase = node.cases.find((c) => c.test === null);
        if (!defaultCase) return;

        if (hasExhaustivenessCheck(defaultCase.consequent)) {
          context.report({
            node: defaultCase,
            messageId: "openUnion",
            data: { url: DOCS_URL },
          });
        }
      },
    };
  },
});
