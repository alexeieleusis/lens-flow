import ts from "typescript";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";
import {
  defaultHasNeverAssertion,
  getLiteralFromExpr,
} from "./ast-helpers.js";

export function getMissingLiteralValues(
  checker: ts.TypeChecker,
  tsNode: ts.Node,
  comparedValues: Set<string>,
): string[] {
  const varType = checker.getTypeAtLocation(tsNode);
  const literalValues = extractLiteralValues(varType);
  const stringLiterals = literalValues.filter(
    (v): v is string => typeof v === "string",
  );

  if (stringLiterals.length < 2) return [];

  return stringLiterals.filter((v) => !comparedValues.has(v));
}

export function reportMissingValues(
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  node: TSESTree.Node,
  checker: ts.TypeChecker,
  tsNode: ts.Node,
  varName: string,
  comparedValues: Set<string>,
  url: string,
): void {
  const missing = getMissingLiteralValues(checker, tsNode, comparedValues);
  if (missing.length === 0) return;

  context.report({
    node,
    messageId: "nonExhaustiveFallback",
    data: {
      varName,
      missing: missing.map((v) => `"${v}"`).join(", "),
      url,
    },
  });
}

function collectUnionIntersectionTypes(
  type: TSESTree.TSUnionType | TSESTree.TSIntersectionType,
): TSESTree.TypeNode[] {
  return [...type.types];
}

function collectTupleTypes(type: TSESTree.TSTupleType): TSESTree.TypeNode[] {
  const children: TSESTree.TypeNode[] = [];
  for (const elem of type.elementTypes) {
    if (elem.type === "TSNamedTupleMember") {
      children.push(elem.elementType);
    } else if (elem.type === "TSRestType") {
      children.push(elem.typeAnnotation);
    } else {
      children.push(elem);
    }
  }
  return children;
}

function collectFunctionParamTypes(
  fn: TSESTree.TSFunctionType | TSESTree.TSConstructorType,
): TSESTree.TypeNode[] {
  const paramTypes = fn.params
    .map((p: TSESTree.Parameter) => {
      const inner = p.type === "TSParameterProperty" ? p.parameter : p;
      return inner.typeAnnotation?.typeAnnotation;
    })
    .filter(Boolean) as TSESTree.TypeNode[];
  const children = [...paramTypes];
  if (fn.returnType) children.push(fn.returnType.typeAnnotation);
  return children;
}

export function collectChildTypes(type: TSESTree.TypeNode): TSESTree.TypeNode[] {
  switch (type.type) {
    case "TSUnionType":
    case "TSIntersectionType":
      return collectUnionIntersectionTypes(type);
    case "TSTupleType":
      return collectTupleTypes(type);
    case "TSArrayType":
      return [type.elementType];
    case "TSIndexedAccessType":
      return [type.objectType, type.indexType];
    case "TSMappedType":
      return type.typeAnnotation ? [type.typeAnnotation] : [];
    case "TSConditionalType":
      return [type.checkType, type.extendsType, type.trueType, type.falseType];
    case "TSRestType":
      return [type.typeAnnotation];
    case "TSInferType":
      return type.typeParameter.constraint
        ? [type.typeParameter.constraint]
        : [];
    case "TSFunctionType":
    case "TSConstructorType":
      return collectFunctionParamTypes(type);
    case "TSTypeQuery":
      return type.exprName.type === "TSImportType" && type.exprName.typeArguments
        ? [...type.exprName.typeArguments.params]
        : [];
    case "TSTypeOperator":
      return type.typeAnnotation ? [type.typeAnnotation] : [];
    case "TSTypeReference":
      return type.typeArguments ? [...type.typeArguments.params] : [];
    case "TSTemplateLiteralType":
      return [];
    default:
      return [];
  }
}

export function extractLiteralValues(tsType: ts.Type): (string | number)[] {
  const values = new Set<string | number>();

  function visit(t: ts.Type) {
    if (t.isUnion()) {
      for (const member of t.types) visit(member);
      return;
    }
    if ((t.flags & ts.TypeFlags.StringLiteral) !== 0) {
      values.add((t as ts.StringLiteralType).value);
      return;
    }
    if ((t.flags & ts.TypeFlags.NumberLiteral) !== 0) {
      values.add((t as ts.NumberLiteralType).value);
    }
  }

  visit(tsType);
  return [...values];
}

export function checkSwitchExhaustiveness(
  node: TSESTree.SwitchStatement,
  checker: ts.TypeChecker,
  tsNode: ts.Node,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  messageId: string,
  url: string,
): void {
  const discriminantType = checker.getTypeAtLocation(tsNode);
  const literalValues = extractLiteralValues(discriminantType);

  if (literalValues.length < 2) return;

  const matchedValues = new Set<string | number>();

  for (const case_ of node.cases) {
    const val = getLiteralFromExpr(case_.test);
    if (val !== null) {
      matchedValues.add(val);
    }
  }

  const missing = literalValues.filter((v) => !matchedValues.has(v));

  if (missing.length === 0) return;

  const defaultCase = node.cases.find((c) => c.test === null);

  if (defaultCase && defaultHasNeverAssertion(defaultCase.consequent)) {
    return;
  }

  context.report({
    node,
    messageId,
    data: {
      missing: missing.map(String).join(", "),
      url,
    },
  });
}
