import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T36-trait-objects.md");

export default createRule({
  name: "no-duplicated-union-properties",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow duplicated property signatures across discriminated union members that should be extracted into a shared interface.",
    },
    messages: {
      duplicatedProperties:
        "{{dupCount}} property signature(s) ({{properties}}) duplicated across union members. Extract shared structure into a common interface. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"duplicatedProperties", []>) {
    const collectMemberLiterals = (
      node: TSESTree.TSUnionType
    ): TSESTree.TSTypeLiteral[][] => {
      const memberGroups: TSESTree.TSTypeLiteral[][] = [];
      for (const member of node.types) {
        if (member.type === "TSTypeLiteral") {
          memberGroups.push([member]);
        } else if (member.type === "TSIntersectionType") {
          const literals: TSESTree.TSTypeLiteral[] = [];
          for (const part of member.types) {
            if (part.type === "TSTypeLiteral") {
              literals.push(part);
            }
          }
          if (literals.length > 0) {
            memberGroups.push(literals);
          }
        }
      }
      return memberGroups;
    };

    const findDuplicatedProperties = (
      propMap: Map<string, Map<string, Set<number>>>,
      discriminants: Set<string>
    ): string[] => {
      const duplicated: string[] = [];
      for (const [propName, typeMap] of propMap) {
        if (discriminants.has(propName)) continue;
        for (const [typeText, idxSet] of typeMap) {
          if (idxSet.size >= 2) {
            duplicated.push(`${propName}: ${typeText}`);
            break;
          }
        }
      }
      return duplicated;
    };

    return {
      TSUnionType(node) {
        const sourceCode = context.sourceCode;

        const memberGroups = collectMemberLiterals(node);
        if (memberGroups.length < 2) return;

        const propMap = new Map<string, Map<string, Set<number>>>();
        const litValues = new Map<string, Set<string>>();

        const processMember = (literal: TSESTree.TSTypeLiteral, idx: number) => {
          for (const mem of literal.members) {
            if (mem.type !== "TSPropertySignature") continue;
            if (!mem.typeAnnotation) continue;

            const propName = extractPropertyName(mem.key);
            if (!propName) continue;

            const typeAnn = mem.typeAnnotation.typeAnnotation;
            const typeText = sourceCode.getText(typeAnn);

            trackLiteralValue(typeAnn, propName);
            trackPropertyOccurrence(propName, typeText, idx);
          }
        };

        const extractPropertyName = (key: TSESTree.PropertyName): string | null => {
          if (key.type === "Identifier") return key.name;
          if (key.type === "Literal") return String(key.value);
          return null;
        };

        const trackLiteralValue = (typeAnn: TSESTree.TSTypeAnnotation["typeAnnotation"], propName: string) => {
          if (typeAnn.type !== "TSLiteralType") return;
          if (typeAnn.literal.type !== "Literal") return;
          const val = String(typeAnn.literal.value);
          if (val === "") return;
          const set = litValues.get(propName) ?? new Set<string>();
          set.add(val);
          litValues.set(propName, set);
        };

        const trackPropertyOccurrence = (propName: string, typeText: string, idx: number) => {
          const typeMap = propMap.get(propName) ?? new Map<string, Set<number>>();
          const idxSet = typeMap.get(typeText) ?? new Set<number>();
          idxSet.add(idx);
          typeMap.set(typeText, idxSet);
          propMap.set(propName, typeMap);
        };

        memberGroups.forEach((group, idx) => {
          for (const literal of group) {
            processMember(literal, idx);
          }
        });

        const discriminants = new Set<string>();
        for (const [propName, values] of litValues) {
          if (values.size === memberGroups.length) {
            discriminants.add(propName);
          }
        }

        const duplicated = findDuplicatedProperties(propMap, discriminants);

        if (discriminants.size === 0) return;
        if (duplicated.length > 0) {
          context.report({
            node,
            messageId: "duplicatedProperties",
            data: {
              dupCount: String(duplicated.length),
              properties: duplicated.join(", "),
              url: URL,
            },
          });
        }
      },
    };
  },
});
