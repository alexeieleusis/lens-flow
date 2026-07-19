import ts from "typescript";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export type LiteralValue = string | number | boolean;

function containsTypeByKeyword(typeNode: TSESTree.TypeNode, keyword: string): boolean {
  if (typeNode.type === keyword) return true;
  return collectChildTypes(typeNode).some((child) => containsTypeByKeyword(child, keyword));
}

export function containsAny(typeNode: TSESTree.TypeNode): boolean {
  return containsTypeByKeyword(typeNode, "TSAnyKeyword");
}

export function containsUnknown(typeNode: TSESTree.TypeNode): boolean {
  return containsTypeByKeyword(typeNode, "TSUnknownKeyword");
}
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

function collectMappedTypeChildren(type: TSESTree.TSMappedType): TSESTree.TypeNode[] {
  return [type.typeAnnotation, type.constraint, type.nameType].filter(
    (n): n is TSESTree.TypeNode => n !== undefined && n !== null,
  );
}

function collectInferTypeChildren(type: TSESTree.TSInferType): TSESTree.TypeNode[] {
  return type.typeParameter.constraint
    ? [type.typeParameter.constraint]
    : [];
}

function collectTypeOperatorChildren(type: TSESTree.TSTypeOperator): TSESTree.TypeNode[] {
  return type.typeAnnotation ? [type.typeAnnotation] : [];
}

function collectTypeReferenceChildren(type: TSESTree.TSTypeReference): TSESTree.TypeNode[] {
  return type.typeArguments ? [...type.typeArguments.params] : [];
}

function collectTypeLiteralChildren(type: TSESTree.TSTypeLiteral): TSESTree.TypeNode[] {
  const children: TSESTree.TypeNode[] = [];
  for (const member of type.members) {
    if (member.typeAnnotation && (member.type === "TSPropertySignature" || member.type === "TSIndexSignature")) {
      children.push(member.typeAnnotation.typeAnnotation);
    }
  }
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
      return collectMappedTypeChildren(type);
    case "TSConditionalType":
      return [type.checkType, type.extendsType, type.trueType, type.falseType];
    case "TSRestType":
      return [type.typeAnnotation];
    case "TSInferType":
      return collectInferTypeChildren(type);
    case "TSFunctionType":
    case "TSConstructorType":
      return collectFunctionParamTypes(type);
    case "TSTypeQuery":
      return [];
    case "TSTypeOperator":
      return collectTypeOperatorChildren(type);
    case "TSTypeReference":
      return collectTypeReferenceChildren(type);
    case "TSTemplateLiteralType":
      return [...type.types];
    case "TSOptionalType":
      return [type.typeAnnotation];
    case "TSTypeLiteral":
      return collectTypeLiteralChildren(type);
    default: {
      const maybeParenthesized = type as unknown as { type: string; typeAnnotation?: TSESTree.TypeNode };
      if (maybeParenthesized.type === "TSParenthesizedType" && maybeParenthesized.typeAnnotation) {
        return [maybeParenthesized.typeAnnotation];
      }
      return [];
    }
  }
}

function extractBooleanFromType(t: ts.Type, checker?: ts.TypeChecker): boolean | undefined {
  const val = (t as ts.Type & { value?: boolean }).value;
  if (val !== undefined) return val;
  if (checker) {
    const str = checker.typeToString(t);
    if (str === "true") return true;
    if (str === "false") return false;
  }
}

function processTypeFlags(t: ts.Type, values: Set<LiteralValue>, checker?: ts.TypeChecker) {
  if ((t.flags & ts.TypeFlags.StringLiteral) !== 0) {
    values.add((t as ts.StringLiteralType).value);
    return;
  }
  if ((t.flags & ts.TypeFlags.NumberLiteral) !== 0) {
    values.add((t as ts.NumberLiteralType).value);
    return;
  }
  if ((t.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
    const val = extractBooleanFromType(t, checker);
    if (val !== undefined) values.add(val);
    return;
  }
  if ((t.flags & ts.TypeFlags.Boolean) !== 0) {
    values.add(true);
    values.add(false);
  }
}

function fallbackExtractUnionBooleans(tsType: ts.Type, values: Set<LiteralValue>, checker?: ts.TypeChecker) {
  if (!tsType.isUnion()) return;
  for (const member of tsType.types) {
    if ((member.flags & ts.TypeFlags.BooleanLiteral) !== 0) {
      const val = extractBooleanFromType(member, checker);
      if (val !== undefined) values.add(val);
    } else if ((member.flags & ts.TypeFlags.Boolean) !== 0) {
      values.add(true);
      values.add(false);
    }
  }
}

export function extractLiteralValues(tsType: ts.Type, checker?: ts.TypeChecker): (LiteralValue)[] {
  const values = new Set<LiteralValue>();

  function visit(t: ts.Type) {
    if (t.isUnion() || t.isIntersection()) {
      for (const member of t.types) visit(member);
      return;
    }
    processTypeFlags(t, values, checker);
  }

  visit(tsType);

  if (values.size === 0) {
    fallbackExtractUnionBooleans(tsType, values, checker);
  }

  return [...values];
}

function resolveLiteralValues(
  rawType: ts.Type,
  discriminantType: ts.Type,
  checker: ts.TypeChecker,
): (LiteralValue)[] {
  let literalValues = extractLiteralValues(discriminantType, checker);

  if (literalValues.length === 0) {
    const apparentStr = checker.typeToString(discriminantType).toLowerCase();
    if (apparentStr === "boolean") {
      return [true, false];
    }

    literalValues = extractLiteralValues(rawType, checker);
    if (literalValues.length === 0) {
      const rawStr = checker.typeToString(rawType).toLowerCase();
      if (rawStr === "boolean") {
        return [true, false];
      }
    }
  }

  return literalValues;
}

function collectMatchedCaseValues(
  cases: TSESTree.SwitchCase[],
): Set<LiteralValue> {
  const matchedValues = new Set<LiteralValue>();

  for (const case_ of cases) {
    const val = getLiteralFromExpr(case_.test);
    if (val !== null) {
      matchedValues.add(val);
    }
  }

  return matchedValues;
}

export function checkSwitchExhaustiveness(
  node: TSESTree.SwitchStatement,
  checker: ts.TypeChecker,
  tsNode: ts.Node | undefined,
  context: Readonly<TSESLint.RuleContext<string, readonly unknown[]>>,
  messageId: string,
  url: string,
): void {
  if (!tsNode) return;

  const rawType = checker.getTypeAtLocation(tsNode);
  const discriminantType = checker.getApparentType(rawType);

  // true | false widens to intrinsic boolean, which getApparentType resolves
  // to an ObjectType (Boolean) with no literal flags — handle explicitly.
  const literalValues = resolveLiteralValues(rawType, discriminantType, checker);

  if (literalValues.length < 2) return;

  const matchedValues = collectMatchedCaseValues(node.cases);
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
