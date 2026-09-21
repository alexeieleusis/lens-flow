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
  const signature = checker.getResolvedSignature(
    tsCallNode as ts.CallExpression | ts.NewExpression,
  );
  const paramDecl = signature?.parameters[argIndex]?.valueDeclaration;
  return (
    !!paramDecl && ts.isParameter(paramDecl) && paramDecl.type !== undefined
  );
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
    const parent: TSESTree.Node | undefined = current.parent;
    if (!parent) return false;

    if (parent.type === "Property" && parent.value === current) {
      current = parent.parent;
      continue;
    }
    if (parent.type === "ArrayExpression") {
      current = parent;
      continue;
    }
    if (parent.type === "VariableDeclarator") {
      return parent.id.type === "Identifier" && !!parent.id.typeAnnotation;
    }
    if (parent.type === "PropertyDefinition") {
      return !!parent.typeAnnotation;
    }
    if (parent.type === "ReturnStatement") {
      const fn = findEnclosingFunction(parent);
      return !!fn?.returnType;
    }
    if (parent.type === "ArrowFunctionExpression") {
      return parent.body === current && !!parent.returnType;
    }
    if (parent.type === "CallExpression" || parent.type === "NewExpression") {
      if (!checker) return false;
      const argIndex = parent.arguments.indexOf(
        current as TSESTree.CallExpressionArgument,
      );
      if (argIndex === -1) return false;
      return callArgumentHasExplicitParamType(
        checker,
        parserServices,
        parent,
        argIndex,
      );
    }
    return false;
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
