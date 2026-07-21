import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T04-generics-bounds.md");

function getMaxPropertyDepth(members: TSESTree.TypeElement[]): number {
  let maxDepth = 0;
  for (const member of members) {
    if (member.type === "TSPropertySignature" && member.typeAnnotation) {
      const depth = getNestingDepth(member.typeAnnotation.typeAnnotation);
      if (depth > maxDepth) maxDepth = depth;
    }
  }
  return maxDepth;
}

function getMaxIntersectionDepth(types: TSESTree.TypeNode[]): number {
  let maxDepth = 0;
  for (const member of types) {
    const depth = getNestingDepth(member);
    if (depth > maxDepth) maxDepth = depth;
  }
  return maxDepth;
}

function getNestingDepth(node: TSESTree.TypeNode): number {
  if (node.type === "TSTypeLiteral") {
    return 1 + getMaxPropertyDepth(node.members);
  }
  if (node.type === "TSIntersectionType") {
    return getMaxIntersectionDepth(node.types);
  }
  if (node.type === "TSUnionType") {
    let maxDepth = 0;
    for (const member of node.types) {
      const depth = getNestingDepth(member);
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }
  return 0;
}

function countProperties(node: TSESTree.TSTypeLiteral): number {
  return node.members.filter((m) => m.type === "TSPropertySignature").length;
}

function calcInterfaceMemberMetrics(members: TSESTree.TSInterfaceBody["body"]) {
  let maxDepth = 0;
  let maxNestedProps = 0;
  for (const member of members) {
    if (member.type === "TSPropertySignature" && member.typeAnnotation) {
      const depth = getNestingDepth(member.typeAnnotation.typeAnnotation);
      if (depth > maxDepth) maxDepth = depth;
      if (member.typeAnnotation.typeAnnotation.type === "TSTypeLiteral") {
        const props = countProperties(member.typeAnnotation.typeAnnotation);
        if (props > maxNestedProps) maxNestedProps = props;
      }
    }
  }
  return { maxDepth, maxNestedProps };
}

export default createRule({
  name: "no-overly-complex-bound",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow overly complex generic type parameter bounds with deep nesting, many intersection members, or construct signatures with deeply nested property types",
    },
    messages: {
      complexIntersection:
        "Type parameter bound has {{count}} intersection members (max: {{max}}). Split into smaller interfaces. See: {{url}}",
      complexTypeLiteral:
        "Type literal in bound has {{count}} properties (max: {{max}}). Extract into a separate interface. See: {{url}}",
      deepNesting:
        "Type parameter bound has nesting depth {{depth}} (max: {{max}}). Flatten the constraint. See: {{url}}",
      complexInterfaceBound:
        "Interface has construct signatures (`new(): T`) alongside deeply nested property types (depth: {{depth}}, nested props: {{props}}). Split into smaller interfaces. See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxIntersectionMembers: {
            type: "number",
            minimum: 1,
          },
          maxProperties: {
            type: "number",
            minimum: 1,
          },
          maxNestingDepth: {
            type: "number",
            minimum: 1,
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [
    {
      maxIntersectionMembers: 3,
      maxProperties: 3,
      maxNestingDepth: 2,
    },
  ],
  create(
    context: TSESLint.RuleContext<
      | "complexTypeLiteral"
      | "deepNesting"
      | "complexIntersection"
      | "complexInterfaceBound",
      [
        {
          maxIntersectionMembers?: number;
          maxProperties?: number;
          maxNestingDepth?: number;
        },
      ]
    >,
  ) {
    const defaults = {
      maxIntersectionMembers: 3,
      maxProperties: 3,
      maxNestingDepth: 2,
    };
    const options = { ...defaults, ...context.options[0] };

    function checkTypeLiteral(
      literal: TSESTree.TSTypeLiteral,
      reportNode: TSESTree.TypeNode,
    ) {
      const props = countProperties(literal);
      if (props >= options.maxProperties) {
        context.report({
          node: literal,
          messageId: "complexTypeLiteral",
          data: {
            count: String(props),
            max: String(options.maxProperties),
            url: URL,
          },
        });
      }

      const depth = getNestingDepth(literal);
      if (depth >= options.maxNestingDepth) {
        context.report({
          node: reportNode,
          messageId: "deepNesting",
          data: {
            depth: String(depth),
            max: String(options.maxNestingDepth),
            url: URL,
          },
        });
      }
    }

    function checkIntersection(
      constraint: TSESTree.TSIntersectionType,
      reportNode: TSESTree.TSTypeParameter,
    ) {
      if (constraint.types.length >= options.maxIntersectionMembers) {
        context.report({
          node: reportNode,
          messageId: "complexIntersection",
          data: {
            count: String(constraint.types.length),
            max: String(options.maxIntersectionMembers),
            url: URL,
          },
        });
      }

      for (const member of constraint.types) {
        let inner = member;
        if (inner.type === "TSTypeLiteral") {
          checkTypeLiteral(inner, member);
        } else if (inner.type === "TSIntersectionType") {
          checkIntersection(inner, reportNode);
        }
      }
    }

    function checkConstraint(
      constraint: TSESTree.TypeNode,
      reportNode: TSESTree.TSTypeParameter,
    ) {
      if (constraint.type === "TSIntersectionType") {
        checkIntersection(constraint, reportNode);
        return;
      }

      if (constraint.type === "TSUnionType") {
        for (const member of constraint.types) {
          checkConstraint(member, reportNode);
        }
        return;
      }

      if (constraint.type === "TSTypeLiteral") {
        checkTypeLiteral(constraint, constraint);
      }
    }

    return {
      TSTypeParameter(node) {
        if (node.constraint) {
          checkConstraint(node.constraint, node);
        }
      },

      TSInterfaceBody(node) {
        const hasConstruct = node.body.some(
          (m) => m.type === "TSConstructSignatureDeclaration",
        );
        if (!hasConstruct) return;

        const { maxDepth, maxNestedProps } = calcInterfaceMemberMetrics(
          node.body,
        );

        if (
          maxDepth >= options.maxNestingDepth ||
          maxNestedProps >= options.maxProperties
        ) {
          context.report({
            node,
            messageId: "complexInterfaceBound",
            data: {
              depth: String(maxDepth),
              props: String(maxNestedProps),
              url: URL,
            },
          });
        }
      },
    };
  },
});
