import { AST_NODE_TYPES, TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T33-self-type.md");

export default createRule({
  name: "no-override-this-with-base-type",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow overriding a base class method returning `this` with a narrower concrete return type.",
    },
    messages: {
      overrideThisWithBaseType:
        "Method \"{{methodName}}\" overrides a base method returning `this` with return type `{{returnType}}`. Use `this` to preserve polymorphism. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"overrideThisWithBaseType", []>) {
    const classBodies = new Map<
      string,
      { body: TSESTree.ClassBody; node: TSESTree.ClassDeclaration | TSESTree.ClassExpression }
    >();

    return {
      "ClassDeclaration[id]"(node: TSESTree.ClassDeclaration) {
        classBodies.set(node.id!.name, { body: node.body, node });
      },

      "VariableDeclarator[id.type='Identifier'][init.type='ClassExpression']"(
        node: TSESTree.VariableDeclarator & {
          id: TSESTree.Identifier;
          init: TSESTree.ClassExpression;
        },
      ) {
        classBodies.set(node.id.name, { body: node.init.body, node: node.init });
      },

     "Program:exit"() {
        for (const { body: childBody, node: childClass } of classBodies.values()) {
          checkChildClass(childClass, childBody, classBodies, context);
        }
      },
    };
  },
});

function methodReturnsThis(member: TSESTree.ClassElement): boolean {
  if (member.type === AST_NODE_TYPES.MethodDefinition) {
    return (
      !member.static &&
      member.value?.returnType?.typeAnnotation?.type === AST_NODE_TYPES.TSThisType
    );
  }
  if (member.type === AST_NODE_TYPES.TSAbstractMethodDefinition) {
    return (
      !member.static &&
      (member as TSESTree.TSAbstractMethodDefinition & { returnType?: TSESTree.TSTypeAnnotation }).returnType?.typeAnnotation?.type === AST_NODE_TYPES.TSThisType
    );
  }
  return false;
}

function collectThisMethods(body: TSESTree.ClassBody): Set<string> {
  const names = new Set<string>();
  for (const member of body.body) {
    if (methodReturnsThis(member)) {
      const methodLike = member as TSESTree.MethodDefinition | TSESTree.TSAbstractMethodDefinition;
      const name = getKeyName(methodLike.key);
      if (name) names.add(name);
    }
  }
  return names;
}

function reportOverride(
  member: TSESTree.MethodDefinition,
  name: string,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  const retAnn = member.value?.returnType?.typeAnnotation;
  if (retAnn?.type === AST_NODE_TYPES.TSThisType) return;

  const returnTypeStr =
    getReturnTypeString(retAnn) ??
    context.sourceCode.getText(retAnn);
  context.report({
    node: member,
    messageId: "overrideThisWithBaseType",
    data: {
      methodName: name,
      returnType: returnTypeStr,
      url: URL,
    },
  });
}

function checkChildClass(
  childClass: TSESTree.ClassDeclaration | TSESTree.ClassExpression,
  childBody: TSESTree.ClassBody,
  classBodies: Map<string, { body: TSESTree.ClassBody; node: TSESTree.ClassDeclaration | TSESTree.ClassExpression }>,
  context: Parameters<ReturnType<typeof createRule>["create"]>[0],
) {
  const superClass = "superClass" in childClass ? (childClass as TSESTree.ClassDeclaration).superClass : null;
  if (superClass?.type !== AST_NODE_TYPES.Identifier) return;

  const parentEntry = classBodies.get(superClass.name);
  if (!parentEntry) return;

  const parentThisMethods = collectThisMethods(parentEntry.body);

  for (const member of childBody.body) {
    if (member.type !== AST_NODE_TYPES.MethodDefinition) continue;
    if (member.static) continue;

    const name = getKeyName(member.key);
    if (!name || !parentThisMethods.has(name)) continue;

    reportOverride(member, name, context);
  }
}

function getKeyName(key: TSESTree.Expression | TSESTree.PrivateIdentifier): string | null {
  if (key.type === AST_NODE_TYPES.Identifier) return key.name;
  if (key.type === AST_NODE_TYPES.Literal && typeof (key as TSESTree.Literal).value === "string") return (key as TSESTree.Literal).value as string;
  return null;
}

function getReturnTypeString(retAnn: TSESTree.TypeNode | undefined): string | null {
  if (!retAnn) return null;
  if (
    retAnn.type === AST_NODE_TYPES.TSTypeReference &&
    retAnn.typeName.type === AST_NODE_TYPES.Identifier
  ) {
    return retAnn.typeName.name;
  }
  return null;
}
