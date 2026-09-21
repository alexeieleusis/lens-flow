import ts from "typescript";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { ParserServices } from "@typescript-eslint/utils";
import {
  isFunctionBoundary,
  type FunctionLikeNode,
} from "../utils/ast-helpers.js";

const URL = knowledgeUrl(
  "catalog/T34-never-bottom.md",
  "Argument of type 'string' is not assignable to parameter of type 'never' (on push)",
);

function isEmptyArrayExpression(
  node: TSESTree.Node | null | undefined,
): node is TSESTree.ArrayExpression {
  return node?.type === "ArrayExpression" && node.elements.length === 0;
}

function findEnclosingFunction(
  node: TSESTree.Node,
): FunctionLikeNode | undefined {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (isFunctionBoundary(current)) return current as FunctionLikeNode;
    current = current.parent;
  }
  return undefined;
}

/**
 * Resolves whether a destructured binding's own type comes from somewhere
 * other than the empty-array default itself (e.g. the pattern's type
 * annotation, or the type of the value being destructured), in which case
 * the default's element type is already fixed and can't widen to `never`.
 */
function destructuredBindingHasInferredType(
  checker: ts.TypeChecker,
  parserServices: ParserServices,
  identifier: TSESTree.Identifier,
): boolean {
  const tsIdentifier = parserServices.esTreeNodeToTSNodeMap.get(identifier);
  if (!tsIdentifier) return false;
  const type = checker.getTypeAtLocation(tsIdentifier);
  if (!checker.isArrayType(type)) return false;
  const [elementType] = checker.getTypeArguments(type as ts.TypeReference);
  return !!elementType && !(elementType.flags & ts.TypeFlags.Never);
}

function callArgumentHasExplicitParamType(
  checker: ts.TypeChecker,
  parserServices: ParserServices,
  callNode: TSESTree.CallExpression | TSESTree.NewExpression,
  argIndex: number,
): boolean {
  const tsCallNode = parserServices.esTreeNodeToTSNodeMap.get(callNode);
  if (!tsCallNode) return false;
  const signature = checker.getResolvedSignature(
    tsCallNode as ts.CallExpression | ts.NewExpression,
  );
  const params = signature?.parameters ?? [];
  const param = params[argIndex] ?? params[params.length - 1];
  const paramDecl = param?.valueDeclaration;
  return (
    !!paramDecl &&
    ts.isParameter(paramDecl) &&
    paramDecl.type !== undefined &&
    (argIndex < params.length || paramDecl.dotDotDotToken !== undefined)
  );
}

function isCallArgumentGoverned(
  checker: ts.TypeChecker | undefined,
  parserServices: ParserServices,
  callNode: TSESTree.CallExpression | TSESTree.NewExpression,
  current: TSESTree.Node,
): boolean {
  if (!checker) return false;
  const argIndex = callNode.arguments.indexOf(
    current as TSESTree.CallExpressionArgument,
  );
  if (argIndex === -1) return false;
  return callArgumentHasExplicitParamType(
    checker,
    parserServices,
    callNode,
    argIndex,
  );
}

type GoverningStep =
  | { done: true; result: boolean }
  | { done: false; next: TSESTree.Node };

/**
 * Single step of the upward walk `isGovernedByExplicitType` performs: either
 * the current parent settles the answer (`done: true`), or it's a
 * transparent object/array literal shell to keep climbing through
 * (`done: false`).
 */
function nextGoverningStep(
  current: TSESTree.Node,
  checker: ts.TypeChecker | undefined,
  parserServices: ParserServices,
): GoverningStep {
  const parent = current.parent;
  if (!parent) return { done: true, result: false };

  switch (parent.type) {
    case "Property":
      return parent.value === current
        ? { done: false, next: parent.parent }
        : { done: true, result: false };
    case "ArrayExpression":
      return { done: false, next: parent };
    case "VariableDeclarator":
      return {
        done: true,
        result: parent.id.type === "Identifier" && !!parent.id.typeAnnotation,
      };
    case "PropertyDefinition":
      return { done: true, result: !!parent.typeAnnotation };
    case "ReturnStatement":
      return {
        done: true,
        result: !!findEnclosingFunction(parent)?.returnType,
      };
    case "ArrowFunctionExpression":
      return {
        done: true,
        result: parent.body === current && !!parent.returnType,
      };
    case "CallExpression":
    case "NewExpression":
      return {
        done: true,
        result: isCallArgumentGoverned(
          checker,
          parserServices,
          parent,
          current,
        ),
      };
    default:
      return { done: true, result: false };
  }
}

/**
 * Walks up through the object/array literal shell an empty array is nested
 * in to find the nearest position that already carries (or is checked
 * against) an explicit type: an annotated variable/field, a typed call
 * argument, or a typed return. `satisfies` and a class's `implements` clause
 * are deliberately excluded — neither one changes the type TypeScript
 * actually retains for the value, so an empty array under either still
 * widens to `never[]`.
 */
function isGovernedByExplicitType(
  startNode: TSESTree.Expression,
  checker: ts.TypeChecker | undefined,
  parserServices: ParserServices,
): boolean {
  let current: TSESTree.Node = startNode;
  for (;;) {
    const step = nextGoverningStep(current, checker, parserServices);
    if (step.done) return step.result;
    current = step.next;
  }
}

export default createRule({
  name: "no-empty-array-never-inference",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty array literals without explicit type annotation, which may infer as never[]",
    },
    messages: {
      emptyArrayNoType:
        "Empty array literal without type annotation is inferred as never[]. Add an explicit type annotation (e.g. string[]) to avoid cryptic errors on push(). See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"emptyArrayNoType", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const checker = parserServices.program?.getTypeChecker();

    return {
      VariableDeclarator(node) {
        const decl = node.parent;
        if (decl.type === "VariableDeclaration" && decl.kind !== "const")
          return;
        if (isEmptyArrayExpression(node.init) && !node.id.typeAnnotation) {
          context.report({
            node: node.init,
            messageId: "emptyArrayNoType",
            data: { url: URL },
          });
        }
      },
      PropertyDefinition(node) {
        if (isEmptyArrayExpression(node.value) && !node.typeAnnotation) {
          context.report({
            node,
            messageId: "emptyArrayNoType",
            data: { url: URL },
          });
        }
      },
      Property(node) {
        if (node.method) return;
        if (
          isEmptyArrayExpression(node.value) &&
          !isGovernedByExplicitType(node.value, checker, parserServices)
        ) {
          context.report({
            node,
            messageId: "emptyArrayNoType",
            data: { url: URL },
          });
        }
      },
      AssignmentPattern(node) {
        if (node.left.type !== "Identifier") return;
        if (
          !node.left.typeAnnotation &&
          isEmptyArrayExpression(node.right) &&
          !(
            checker &&
            destructuredBindingHasInferredType(
              checker,
              parserServices,
              node.left,
            )
          )
        ) {
          context.report({
            node,
            messageId: "emptyArrayNoType",
            data: { url: URL },
          });
        }
      },
    };
  },
});
