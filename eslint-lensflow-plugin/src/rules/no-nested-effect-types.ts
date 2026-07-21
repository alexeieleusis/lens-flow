import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T12-effect-tracking.md");

const DEFAULT_EFFECT_TYPES = new Set([
  "Promise",
  "Task",
  "TaskEither",
  "Effect",
  "Result",
  "Either",
]);

function getTypeRefName(node: TSESTree.TypeNode): string | null {
  if (node.type !== "TSTypeReference") return null;
  const tn = node.typeName;
  if (tn.type === "Identifier") return tn.name;
  if (tn.type === "TSQualifiedName" && tn.right.type === "Identifier")
    return tn.right.name;
  return null;
}

function getTypeArgs(node: TSESTree.TypeNode): TSESTree.TypeNode[] | undefined {
  if (node.type === "TSTypeReference" && node.typeArguments) {
    return node.typeArguments.params;
  }
  return undefined;
}

function findDirectNestedEffect(
  outerName: string,
  node: TSESTree.TypeNode,
  effectTypeSet: Set<string>,
): { outer: string; inner: string } | null {
  const args = getTypeArgs(node);
  if (!args) return null;

  for (const arg of args) {
    const argName = getTypeRefName(arg);
    if (argName && effectTypeSet.has(argName)) {
      return { outer: outerName, inner: argName };
    }
  }
  return null;
}

function findDeepNestedEffect(
  node: TSESTree.TypeNode,
  effectTypeSet: Set<string>,
): { outer: string; inner: string } | null {
  const args = getTypeArgs(node);
  if (!args) return null;

  for (const arg of args) {
    const deeper = findNestedEffect(arg, effectTypeSet);
    if (deeper) return deeper;
  }
  return null;
}

function findNestedEffect(
  node: TSESTree.TypeNode,
  effectTypeSet: Set<string>,
): { outer: string; inner: string } | null {
  const outerName = getTypeRefName(node);
  if (outerName && effectTypeSet.has(outerName)) {
    const direct = findDirectNestedEffect(outerName, node, effectTypeSet);
    if (direct) return direct;

    const deep = findDeepNestedEffect(node, effectTypeSet);
    if (deep) return deep;
  }

  return findDeepNestedEffect(node, effectTypeSet);
}

export default createRule({
  name: "no-nested-effect-types",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow effect types nested inside other effect types (e.g., Promise<Result<Promise<User>, Error>>). Flatten to a single stacked effect instead.",
    },
    messages: {
      nestedEffect:
        "Nested effect type detected: {{outer}} wraps {{inner}}. Flatten to a single stacked effect type (e.g., TaskEither<E, A>). See: {{url}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          effectTypes: {
            type: "array",
            items: { type: "string" },
            description: "List of effect type names to consider.",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: undefined,
  },
  defaultOptions: [{ effectTypes: Array.from(DEFAULT_EFFECT_TYPES) }],

  create(
    context: TSESLint.RuleContext<"nestedEffect", [{ effectTypes: string[] }]>,
  ) {
    const [
      { effectTypes } = { effectTypes: Array.from(DEFAULT_EFFECT_TYPES) },
    ] = context.options ?? [{ effectTypes: Array.from(DEFAULT_EFFECT_TYPES) }];
    const effectTypeSet = new Set(effectTypes);

    function checkReturnTypesNode(
      node:
        | TSESTree.TSFunctionType
        | TSESTree.TSDeclareFunction
        | TSESTree.TSEmptyBodyFunctionExpression
        | TSESTree.TSMethodSignature
        | TSESTree.TSCallSignatureDeclaration
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      const returnAnnotation = (
        node as TSESTree.ArrowFunctionExpression & {
          returnType?: TSESTree.TSTypeAnnotation | null;
        }
      ).returnType?.typeAnnotation;
      if (!returnAnnotation) return;

      const nested = findNestedEffect(returnAnnotation, effectTypeSet);

      if (nested) {
        context.report({
          node,
          messageId: "nestedEffect",
          data: {
            outer: nested.outer,
            inner: nested.inner,
            url: URL,
          },
        });
      }
    }

    return {
      TSFunctionType(node) {
        checkReturnTypesNode(node);
      },

      TSMethodSignature(node) {
        checkReturnTypesNode(node);
      },

      ArrowFunctionExpression(node) {
        checkReturnTypesNode(node);
      },

      FunctionDeclaration(node) {
        checkReturnTypesNode(node);
      },

      FunctionExpression(node) {
        if (node.parent?.type === "MethodDefinition") return;
        checkReturnTypesNode(node);
      },

      TSEmptyBodyFunctionExpression(node) {
        checkReturnTypesNode(node);
      },

      TSDeclareFunction(node) {
        checkReturnTypesNode(node);
      },

      TSCallSignatureDeclaration(node) {
        checkReturnTypesNode(node);
      },

      MethodDefinition(node) {
        if (node.value && node.value.type !== "TSEmptyBodyFunctionExpression") {
          checkReturnTypesNode(node.value);
        }
      },
    };
  },
});
