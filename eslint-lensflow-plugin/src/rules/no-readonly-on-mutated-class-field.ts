import { createRule } from "../utils/rule-creator.js";
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

function extractFieldName(key: TSESTree.Node): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "PrivateIdentifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

function isReadonlyField(member: TSESTree.ClassElement): member is TSESTree.PropertyDefinition {
  return member.type === "PropertyDefinition" && member.readonly;
}

function collectConstructorParamFields(member: TSESTree.MethodDefinition, fields: Set<string>) {
  if (member.kind !== "constructor" || !member.value) return;
  for (const param of member.value.params) {
    if (param.type === "TSParameterProperty") {
      const inner = param.parameter;
      if (inner.type === "Identifier") {
        fields.add(inner.name);
      }
    }
  }
}

export default createRule({
  name: "no-readonly-on-mutated-class-field",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow mutating a readonly class field outside the constructor",
    },
    messages: {
      mutationOfReadonly:
        "Cannot assign to readonly field '{{field}}' outside the constructor. readonly fields can only be assigned at declaration or in the constructor. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T32-immutability-markers.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"mutationOfReadonly", []>) {
    const readonlyFieldsMap = new Map<TSESTree.ClassBody, Set<string>>();
    const constructorClassBodies: TSESTree.ClassBody[] = [];

    function findEnclosingClassBody(node: TSESTree.Node): TSESTree.ClassBody | null {
      let current: TSESTree.Node | undefined = node;
      while (current) {
        if (current.type === "ClassBody") return current;
        current = current.parent;
      }
      return null;
    }

    function isInsideMatchingConstructor(enclosingClass: TSESTree.ClassBody): boolean {
      return constructorClassBodies.includes(enclosingClass);
    }

    function getConstructorClassBody(node: TSESTree.MethodDefinition): TSESTree.ClassBody | null {
      if (node.kind !== "constructor") return null;
      return node.parent;
    }

    function checkAssignment(node: TSESTree.AssignmentExpression | TSESTree.UpdateExpression) {
      let prop: TSESTree.Node;

      if (node.type === "AssignmentExpression") {
        if (node.left.type !== "MemberExpression") return;
        if (node.left.object.type !== "ThisExpression") return;
        prop = node.left.property;
      } else {
        if (node.argument.type !== "MemberExpression") return;
        if (node.argument.object.type !== "ThisExpression") return;
        prop = node.argument.property;
      }

      const fieldName = extractFieldName(prop);
      if (!fieldName) return;

      const enclosingClass = findEnclosingClassBody(node);
      if (!enclosingClass) return;

      const readonlyFields = readonlyFieldsMap.get(enclosingClass);
      if (!readonlyFields?.has(fieldName)) return;
      if (isInsideMatchingConstructor(enclosingClass)) return;

      context.report({
        node,
        messageId: "mutationOfReadonly",
        data: { field: fieldName },
      });
    }

    return {
      ClassBody(node) {
        const readonlyFields = new Set<string>();

        for (const member of node.body) {
          if (isReadonlyField(member)) {
            const fieldName = extractFieldName(member.key);
            if (fieldName) {
              readonlyFields.add(fieldName);
            }
          }
          if (member.type === "MethodDefinition") {
            collectConstructorParamFields(member, readonlyFields);
          }
        }

        readonlyFieldsMap.set(node, readonlyFields);
      },
      "ClassBody:exit"(node) {
        readonlyFieldsMap.delete(node);
      },
      MethodDefinition(node) {
        const classBody = getConstructorClassBody(node);
        if (classBody) {
          constructorClassBodies.push(classBody);
        }
      },
      "MethodDefinition:exit"(node) {
        if (node.kind === "constructor") {
          constructorClassBodies.pop();
        }
      },
      AssignmentExpression(node) {
        checkAssignment(node);
      },
      UpdateExpression(node) {
        checkAssignment(node);
      },
    };
  },
});
