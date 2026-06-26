import ts from "typescript";
import { ESLintUtils, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

const KNOWLEDGE_URL =
  "https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC19-serialization.md";

const UNSAFE_CONSTRUCTORS = new Set([
  "Date",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "WeakRef",
  "FinalizationRegistry",
  "RegExp",
  "Error",
  "Symbol",
]);

function isJsonStringifyCall(node: TSESTree.CallExpression): boolean {
  return (
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "stringify"
  );
}

const PRIMITIVE_FLAGS =
  ts.TypeFlags.String |
  ts.TypeFlags.Number |
  ts.TypeFlags.Boolean |
  ts.TypeFlags.Null |
  ts.TypeFlags.Undefined |
  ts.TypeFlags.StringLiteral |
  ts.TypeFlags.NumberLiteral |
  ts.TypeFlags.BooleanLiteral |
  ts.TypeFlags.EnumLiteral;

function checkPrimitiveFlags(type: ts.Type): string[] | null {
  if (type.flags & PRIMITIVE_FLAGS) return [];
  if (type.flags & ts.TypeFlags.BigInt) return ["bigint"];
  if (type.flags & ts.TypeFlags.Symbol) return ["Symbol"];
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return [];
  if (type.flags & ts.TypeFlags.Never) return [];
  return null;
}

function checkSymbolUnsafe(type: ts.Type): string[] | null {
  const symName = type.symbol?.name;
  if (!symName) return null;
  if (UNSAFE_CONSTRUCTORS.has(symName)) return [symName];
  if (symName === "Function") return ["Function"];
  return null;
}

function isFunctionDeclaration(type: ts.Type): boolean {
  const decl = type.symbol?.valueDeclaration;
  if (!decl) return false;
  return (
    decl.kind === ts.SyntaxKind.FunctionType ||
    decl.kind === ts.SyntaxKind.FunctionExpression ||
    decl.kind === ts.SyntaxKind.ArrowFunction
  );
}

function hasToJSON(type: ts.Type): boolean {
  const toJSON = type.getProperty("toJSON");
  if (!toJSON.length) return false;
  const toJSONType = toJSON[0].valueDeclaration
    ? toJSON[0].valueDeclaration.type
    : undefined;
  if (toJSONType) {
    const callSigs = toJSONType.getCallSignatures();
    if (callSigs.length > 0) return true;
  }
  return false;
}

function collectFromTypeMembers(
  members: readonly ts.Type[],
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): string[] {
  const found: string[] = [];
  for (const member of members) {
    found.push(...collectUnsafeTypes(member, checker, seen));
  }
  return [...new Set(found)];
}

function collectFromObjectProps(
  props: readonly ts.Symbol[],
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): string[] {
  const found: string[] = [];
  for (const prop of props) {
    found.push(...collectUnsafeTypes(checker.getTypeOfSymbol(prop), checker, seen));
  }
  return [...new Set(found)];
}

function collectUnsafeTypes(
  type: ts.Type,
  checker: ts.TypeChecker,
  seen: Set<ts.Type>,
): string[] {
  if (seen.has(type)) return [];
  seen.add(type);

  const primResult = checkPrimitiveFlags(type);
  if (primResult !== null) return primResult;

  const symResult = checkSymbolUnsafe(type);
  if (symResult !== null) return symResult;

  if (isFunctionDeclaration(type)) return ["Function"];

  if (hasToJSON(type)) return [];

  if (type.isUnion() || type.isIntersection()) {
    return collectFromTypeMembers(type.types, checker, seen);
  }

  if (checker.isTupleType(type)) {
    return collectFromTypeMembers(
      checker.getTypeArguments(type as ts.TypeReference),
      checker,
      seen,
    );
  }

  if (checker.isArrayType(type)) {
    const elemType = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (elemType) return collectUnsafeTypes(elemType, checker, seen);
    return [];
  }

  const props = type.getProperties();
  if (props.length > 0) {
    return collectFromObjectProps(props, checker, seen);
  }

  return [];
}

export default createRule({
  name: "no-unsafe-json-stringify",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow JSON.stringify on values containing non-JSON-safe types (Date, bigint, Map, Set, etc.) without first transforming through a serialized mapped type or manual converter.",
    },
    messages: {
      unsafeType:
        "JSON.stringify called on a value containing non-JSON-safe type(s) ({{types}}). Transform to a serialized mapped type or use a manual converter. See: " +
        KNOWLEDGE_URL,
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"unsafeType", []>) {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    return {
      CallExpression(node) {
        if (!isJsonStringifyCall(node)) return;
        if (node.arguments.length === 0) return;

        const firstArg = node.arguments[0];
        const firstArgTs = esTreeNodeToTSNodeMap.get(firstArg);
        if (!firstArgTs) return;

        const firstArgType = checker.getTypeAtLocation(
          firstArgTs as ts.Expression,
        );
        const unsafe = collectUnsafeTypes(firstArgType, checker, new Set());

        if (unsafe.length > 0) {
          context.report({
            node,
            messageId: "unsafeType",
            data: {
              types: [...new Set(unsafe)].join(", "),
            },
          });
        }
      },
    };
  },
});
