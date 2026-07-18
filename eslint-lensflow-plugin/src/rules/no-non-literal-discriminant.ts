import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T01-algebraic-data-types.md");

type WidenedKind = "string" | "number" | null;

const DISCRIMINANT_NAMES = new Set([
  "kind",
  "type",
  "status",
  "tag",
  "code",
  "discriminant",
  "dtype",
  "t",
  "variant",
  "case",
  "flavor",
]);

function getPropertyName(key: TSESTree.Expression): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  if (key.type === "Literal" && typeof key.value === "number") return String(key.value);
  return null;
}

function classifyTypeFlags(propType: ts.Type): {
  widened: WidenedKind;
  hasLiteral: boolean;
} {
  const isWidenedStr =
    (propType.flags & ts.TypeFlags.String) !== 0 &&
    (propType.flags & ts.TypeFlags.StringLiteral) === 0;
  const isWidenedNum =
    (propType.flags & ts.TypeFlags.Number) !== 0 &&
    (propType.flags & ts.TypeFlags.NumberLiteral) === 0;
  const isLiteralStr = (propType.flags & ts.TypeFlags.StringLiteral) !== 0;
  const isLiteralNum = (propType.flags & ts.TypeFlags.NumberLiteral) !== 0;

  const widened = isWidenedStr ? "string" : isWidenedNum ? "number" : null;
  return { widened, hasLiteral: isLiteralStr || isLiteralNum };
}

function isTrackableType(propType: ts.Type): boolean {
  const { widened, hasLiteral } = classifyTypeFlags(propType);
  return widened !== null || hasLiteral;
}

export default createRule({
  name: "no-non-literal-discriminant",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow discriminant-named properties (kind, type, status, etc.) in unions that use widened types (string, number) in some members while using literal types in others, when the property is present in all union members.",
    },
    messages: {
      nonLiteralDiscriminant:
        "Discriminant property `{{propName}}` uses widened type `{{type}}` instead of a literal type. Use a literal type so the union can be narrowed. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"nonLiteralDiscriminant", []>) {
    const parserServices = ESLintUtils.getParserServices(
      context,
      true,
    );
    const program = parserServices.program;
    const hasTypeChecker = !!program;
    const checker = program ? program.getTypeChecker() : null;

    return {
      TSUnionType(node) {
        const members = node.types;
        if (members.length < 2) return;

        interface PropEntry {
          sig: TSESTree.TSPropertySignature;
          widened: WidenedKind;
          hasLiteral: boolean;
        }

        function processRuntimeType(
          tsNode: ts.Node,
          propMap: Map<string, PropEntry[]>,
        ) {
          const memberType = checker!.getTypeAtLocation(tsNode);
          const props = checker!.getPropertiesOfType(memberType);
          for (const prop of props) {
            const propType = checker!.getTypeOfSymbolAtLocation(prop, tsNode);
            const propName = prop.getName();

            if (!DISCRIMINANT_NAMES.has(propName)) continue;
            if (!isTrackableType(propType)) continue;
            if (!prop.valueDeclaration) continue;

            const estreeNode = parserServices.tsNodeToESTreeNodeMap.get(
              prop.valueDeclaration,
            ) as TSESTree.TSPropertySignature | undefined;
            if (!estreeNode) continue;

            const { widened, hasLiteral } = classifyTypeFlags(propType);
            addPropToMap(propName, estreeNode, widened, hasLiteral, propMap);
          }
        }

        function addPropToMap(
          propName: string,
          sig: TSESTree.TSPropertySignature,
          widened: WidenedKind,
          hasLiteral: boolean,
          propMap: Map<string, PropEntry[]>,
        ) {
          const entry: PropEntry = { sig, widened, hasLiteral };
          const existing = propMap.get(propName);
          if (existing) {
            existing.push(entry);
          } else {
            propMap.set(propName, [entry]);
          }
        }

        function analyzePropertySignature(
          member: TSESTree.TypeElement,
        ): {
          propName: string;
          sig: TSESTree.TSPropertySignature;
          widened: WidenedKind;
          hasLiteral: boolean;
        } | null {
          if (member.type !== "TSPropertySignature") return null;
          const propName = getPropertyName(member.key);
          if (!propName) return null;
          const typeAnn = member.typeAnnotation?.typeAnnotation;
          if (!typeAnn) return null;

          let widened: WidenedKind = null;
          if (typeAnn.type === "TSStringKeyword") {
            widened = "string";
          } else if (typeAnn.type === "TSNumberKeyword") {
            widened = "number";
          }

          return {
            propName,
            sig: member,
            widened,
            hasLiteral: typeAnn.type === "TSLiteralType",
          };
        }

        function processTypeReference(
          typeNode: TSESTree.TSTypeReference,
          visited: Set<TSESTree.TSTypeReference>,
          propMap: Map<string, PropEntry[]>,
        ) {
          if (visited.has(typeNode)) return;

          if (hasTypeChecker && checker) {
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(typeNode);
            const symbol = checker.getSymbolAtLocation(tsNode);
            const decl = symbol?.declarations?.[0];

            if (decl?.kind === ts.SyntaxKind.TypeAliasDeclaration) {
              const declType = (decl as ts.TypeAliasDeclaration).type;
              if (declType) {
                processRuntimeType(tsNode, propMap);
                return;
              }
            }
          }

          visited = new Set(visited);
          visited.add(typeNode);
        }

        function processIndexedAccessType(
          typeNode: TSESTree.TSIndexedAccessType,
          propMap: Map<string, PropEntry[]>,
        ) {
          if (hasTypeChecker && checker) {
            const tsNode = parserServices.esTreeNodeToTSNodeMap.get(typeNode);
            processRuntimeType(tsNode, propMap);
          }
        }

        function processIntersectionType(
          typeNode: TSESTree.TSIntersectionType,
          visited: Set<TSESTree.TSTypeReference>,
          out: TSESTree.TSTypeLiteral[],
          propMap: Map<string, PropEntry[]>,
        ) {
          for (const intersectMember of typeNode.types) {
            processType(intersectMember, visited, out, propMap);
          }
        }

        const processType = (
          typeNode: TSESTree.TypeNode,
          visited: Set<TSESTree.TSTypeReference>,
          out: TSESTree.TSTypeLiteral[],
          propMap: Map<string, PropEntry[]>,
        ) => {
          if (typeNode.type === "TSTypeLiteral") {
            out.push(typeNode);
            for (const member of typeNode.members) {
              const analysis = analyzePropertySignature(member);
              if (!analysis) continue;
              addPropToMap(
                analysis.propName,
                analysis.sig,
                analysis.widened,
                analysis.hasLiteral,
                propMap,
              );
            }
          } else if (typeNode.type === "TSTypeReference") {
            processTypeReference(typeNode, visited, propMap);
          } else if (typeNode.type === "TSIndexedAccessType") {
            processIndexedAccessType(typeNode, propMap);
          } else if (typeNode.type === "TSIntersectionType") {
            processIntersectionType(typeNode, visited, out, propMap);
          }
        };

        const propMap = new Map<string, PropEntry[]>();
        for (const member of members) {
          processType(member, new Set<TSESTree.TSTypeReference>(), [], propMap);
        }

        const allLiterals: TSESTree.TSTypeLiteral[] = [];
        for (const member of members) {
          processType(member, new Set<TSESTree.TSTypeReference>(), allLiterals, new Map());
        }
        const totalCount = allLiterals.length;

        for (const [propName, entries] of propMap) {
          if (!DISCRIMINANT_NAMES.has(propName)) continue;
          if (entries.length < totalCount) continue;

          const hasWidened = entries.some((e) => e.widened !== null);
          const hasLiteral = entries.some((e) => e.hasLiteral);

          if (!hasLiteral || !hasWidened) continue;

          for (const entry of entries) {
            if (entry.widened) {
              context.report({
                node: entry.sig,
                messageId: "nonLiteralDiscriminant",
                data: { propName, type: entry.widened, url: URL },
              });
            }
          }
        }
      },
    };
  },
});
