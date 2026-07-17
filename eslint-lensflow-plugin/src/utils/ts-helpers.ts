import ts from "typescript";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export type LiteralValue = string | number | boolean;

export function containsAny(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSAnyKeyword") return true;
  if (typeNode.type === "TSUnionType" || typeNode.type === "TSIntersectionType") {
    return typeNode.types.some(containsAny);
  }
  if (typeNode.type === "TSArrayType") {
    return containsAny(typeNode.elementType);
  }
  if (typeNode.type === "TSTypeReference") {
    return (typeNode.typeArguments?.params ?? []).some(containsAny);
  }
  if (typeNode.type === "TSTupleType") {
    return typeNode.elementTypes.some((elem) => {
      if (elem.type === "TSNamedTupleMember") return containsAny(elem.elementType);
      if (elem.type === "TSRestType") return containsAny(elem.typeAnnotation);
      return containsAny(elem);
    });
  }
  if (typeNode.type === "TSTypeLiteral") {
    return typeNode.members.some((member) => {
      if (member.type === "TSPropertySignature") {
        return member.typeAnnotation
          ? containsAny(member.typeAnnotation.typeAnnotation)
          : false;
      }
      if (member.type === "TSIndexSignature") {
        return member.typeAnnotation
          ? containsAny(member.typeAnnotation.typeAnnotation)
          : false;
      }
      return false;
    });
  }
  if (typeNode.type === "TSFunctionType" || typeNode.type === "TSConstructorType") {
    const paramAny = typeNode.params.some((p) => {
      const inner = p.type === "TSParameterProperty" ? p.parameter : p;
      return inner.typeAnnotation ? containsAny(inner.typeAnnotation.typeAnnotation) : false;
    });
    if (paramAny) return true;
    if (typeNode.returnType) return containsAny(typeNode.returnType.typeAnnotation);
  }
  if (typeNode.type === "TSConditionalType") {
    return (
      containsAny(typeNode.checkType) ||
      containsAny(typeNode.extendsType) ||
      containsAny(typeNode.trueType) ||
      containsAny(typeNode.falseType)
    );
  }
  if (typeNode.type === "TSMappedType") {
    return typeNode.typeAnnotation ? containsAny(typeNode.typeAnnotation) : false;
  }
  if (typeNode.type === "TSIndexedAccessType") {
    return containsAny(typeNode.objectType) || containsAny(typeNode.indexType);
  }
  if (typeNode.type === "TSRestType") {
    return containsAny(typeNode.typeAnnotation);
  }
  if (typeNode.type === "TSInferType") {
    return typeNode.typeParameter.constraint
      ? containsAny(typeNode.typeParameter.constraint)
      : false;
  }
  if (typeNode.type === "TSTypeOperator") {
    return typeNode.typeAnnotation ? containsAny(typeNode.typeAnnotation) : false;
  }
  if (typeNode.type === "TSOptionalType") {
    return containsAny(typeNode.typeAnnotation);
  }
  // TSParenthesizedType can appear at runtime but isn't in @typescript-eslint types
  {
    const maybe = typeNode as unknown as { type: string; typeAnnotation: TSESTree.TypeNode };
    if (maybe.type === "TSParenthesizedType") return containsAny(maybe.typeAnnotation);
  }
  return false;
}

export function containsUnknown(typeNode: TSESTree.TypeNode): boolean {
  if (typeNode.type === "TSUnknownKeyword") return true;
  if (typeNode.type === "TSUnionType" || typeNode.type === "TSIntersectionType") {
    return typeNode.types.some(containsUnknown);
  }
  if (typeNode.type === "TSArrayType") {
    return containsUnknown(typeNode.elementType);
  }
  if (typeNode.type === "TSTypeReference") {
    return (typeNode.typeArguments?.params ?? []).some(containsUnknown);
  }
  if (typeNode.type === "TSTupleType") {
    return typeNode.elementTypes.some((elem) => {
      if (elem.type === "TSNamedTupleMember") return containsUnknown(elem.elementType);
      if (elem.type === "TSRestType") return containsUnknown(elem.typeAnnotation);
      return containsUnknown(elem);
    });
  }
  if (typeNode.type === "TSTypeLiteral") {
    return typeNode.members.some((member) => {
      if (member.type === "TSPropertySignature") {
        return member.typeAnnotation
          ? containsUnknown(member.typeAnnotation.typeAnnotation)
          : false;
      }
      if (member.type === "TSIndexSignature") {
        return member.typeAnnotation
          ? containsUnknown(member.typeAnnotation.typeAnnotation)
          : false;
      }
      return false;
    });
  }
  if (typeNode.type === "TSFunctionType" || typeNode.type === "TSConstructorType") {
    const paramUnknown = typeNode.params.some((p) => {
      const inner = p.type === "TSParameterProperty" ? p.parameter : p;
      return inner.typeAnnotation ? containsUnknown(inner.typeAnnotation.typeAnnotation) : false;
    });
    if (paramUnknown) return true;
    if (typeNode.returnType) return containsUnknown(typeNode.returnType.typeAnnotation);
  }
  if (typeNode.type === "TSConditionalType") {
    return (
      containsUnknown(typeNode.checkType) ||
      containsUnknown(typeNode.extendsType) ||
      containsUnknown(typeNode.trueType) ||
      containsUnknown(typeNode.falseType)
    );
  }
  if (typeNode.type === "TSMappedType") {
    return typeNode.typeAnnotation ? containsUnknown(typeNode.typeAnnotation) : false;
  }
  if (typeNode.type === "TSIndexedAccessType") {
    return containsUnknown(typeNode.objectType) || containsUnknown(typeNode.indexType);
  }
  if (typeNode.type === "TSRestType") {
    return containsUnknown(typeNode.typeAnnotation);
  }
  if (typeNode.type === "TSInferType") {
    return typeNode.typeParameter.constraint
      ? containsUnknown(typeNode.typeParameter.constraint)
      : false;
  }
  if (typeNode.type === "TSTypeOperator") {
    return typeNode.typeAnnotation ? containsUnknown(typeNode.typeAnnotation) : false;
  }
  if (typeNode.type === "TSOptionalType") {
    return containsUnknown(typeNode.typeAnnotation);
  }
  // TSParenthesizedType can appear at runtime but isn't in @typescript-eslint types
  {
    const maybe = typeNode as unknown as { type: string; typeAnnotation: TSESTree.TypeNode };
    if (maybe.type === "TSParenthesizedType") return containsUnknown(maybe.typeAnnotation);
  }
  return false;
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
      return [type.typeAnnotation, type.constraint, type.nameType].filter(Boolean) as TSESTree.TypeNode[];
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
      return [];
    case "TSTypeOperator":
      return type.typeAnnotation ? [type.typeAnnotation] : [];
    case "TSTypeReference":
      return type.typeArguments ? [...type.typeArguments.params] : [];
    case "TSTemplateLiteralType":
      return [...type.types];
    case "TSOptionalType":
      return [type.typeAnnotation];
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
