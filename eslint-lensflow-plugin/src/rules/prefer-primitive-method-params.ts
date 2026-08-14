import type { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { walk, walkNodes } from "../utils/ast-helpers.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "usecases/UC10-encapsulation.md",
  "Accepting mutable params",
);

type NamedFunction =
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.ArrowFunctionExpression;

function getFunctionName(node: NamedFunction): string | undefined {
  if (node.type === "FunctionDeclaration") return node.id?.name;

  const { parent } = node;
  if (
    parent?.type === "VariableDeclarator" &&
    parent.id.type === "Identifier"
  ) {
    return parent.id.name;
  }
  if (
    parent?.type === "AssignmentExpression" &&
    parent.left.type === "Identifier"
  ) {
    return parent.left.name;
  }
  return undefined;
}

// A bare "Element" identifier is ambiguous with the DOM `Element` type, so
// it's only recognized when qualified (e.g. `JSX.Element`, `React.Element`).
// FC/FunctionComponent/VFC type the *component itself*, not what it returns,
// so they never belong here, qualified or not.
const REACT_ELEMENT_TYPE_NAMES = new Set(["ReactElement", "ReactNode"]);
const QUALIFIED_REACT_ELEMENT_TYPE_NAMES = new Set([
  ...REACT_ELEMENT_TYPE_NAMES,
  "Element",
]);

function isReactElementReturnType(
  returnType: TSESTree.TSTypeAnnotation | undefined,
): boolean {
  const typeNode = returnType?.typeAnnotation;
  if (typeNode?.type !== "TSTypeReference") return false;

  const { typeName } = typeNode;
  if (typeName.type === "Identifier") {
    return REACT_ELEMENT_TYPE_NAMES.has(typeName.name);
  }
  if (
    typeName.type === "TSQualifiedName" &&
    typeName.right.type === "Identifier"
  ) {
    return QUALIFIED_REACT_ELEMENT_TYPE_NAMES.has(typeName.right.name);
  }
  return false;
}

function isJSXExpression(node: TSESTree.Node | null | undefined): boolean {
  if (!node) return false;
  if (node.type === "JSXElement" || node.type === "JSXFragment") return true;
  if (node.type === "ConditionalExpression") {
    return isJSXExpression(node.consequent) || isJSXExpression(node.alternate);
  }
  if (node.type === "LogicalExpression") return isJSXExpression(node.right);
  return false;
}

function returnsJSX(body: TSESTree.Node | null): boolean {
  if (!body) return false;
  if (body.type !== "BlockStatement") return isJSXExpression(body);
  return walkNodes(
    body,
    (n) => n.type === "ReturnStatement" && isJSXExpression(n.argument),
  );
}

// React function components are conventionally PascalCase and return JSX; their
// props are always passed as a single object by the JSX calling convention (and by
// tooling like Storybook `args`), so a primitive parameter is not an option here
// even when only one prop is read.
function isReactComponent(node: NamedFunction): boolean {
  const name = getFunctionName(node);
  if (!name || !/^[A-Z]/.test(name)) return false;
  return isReactElementReturnType(node.returnType) || returnsJSX(node.body);
}

function analyzeFunction(
  context: Parameters<
    NonNullable<Parameters<typeof createRule>[0]["create"]>
  >[0],
  params: TSESTree.Parameter[],
  body: TSESTree.Node | null,
) {
  for (const param of params) {
    if (param.type !== "Identifier") continue;

    const paramName = param.name;
    const typeAnn = param.typeAnnotation?.typeAnnotation;
    if (typeAnn?.type !== "TSTypeLiteral") continue;

    if (!body) continue;

    const accessedProperties = new Set<string>();
    let hasBareCallArg = false;

    walk(
      body,
      (n) => {
        if (
          n.type === "MemberExpression" &&
          n.object.type === "Identifier" &&
          n.object.name === paramName
        ) {
          const { property, computed } = n;
          if (property.type === "Identifier" && !computed) {
            accessedProperties.add(property.name);
          } else if (
            property.type === "Literal" &&
            computed &&
            typeof property.value === "string"
          ) {
            accessedProperties.add(property.value);
          }
        }

        if (n.type === "CallExpression") {
          for (const arg of n.arguments) {
            if (arg.type === "Identifier" && arg.name === paramName) {
              hasBareCallArg = true;
            }
          }
        }
      },
      { skipTypeAnnotations: true },
    );

    if (accessedProperties.size !== 1 || hasBareCallArg) continue;

    const propertyName = accessedProperties.values().next().value!;

    // A `readonly` property can't be reassigned through this reference, so the
    // "caller mutates after passing" concern this rule guards against doesn't
    // apply — extracting it to a primitive buys no encapsulation benefit.
    const member = typeAnn.members.find(
      (m): m is TSESTree.TSPropertySignature =>
        m.type === "TSPropertySignature" &&
        !m.computed &&
        ((m.key.type === "Identifier" && m.key.name === propertyName) ||
          (m.key.type === "Literal" &&
            typeof m.key.value === "string" &&
            m.key.value === propertyName)),
    );
    if (member?.readonly) continue;

    context.report({
      node: param,
      messageId: "preferPrimitive",
      data: {
        param: paramName,
        property: propertyName,
        type: "string",
        url: URL,
      },
    });
  }
}

export default createRule({
  name: "prefer-primitive-method-params",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer primitive method parameters over object parameters when only a single property is extracted",
    },
    messages: {
      preferPrimitive:
        "Method accepts object `{{param}}` but only extracts `{{property}}`. Prefer `{{property}}: {{type}}` as a primitive parameter instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"preferPrimitive", []>) {
    return {
      MethodDefinition(node) {
        analyzeFunction(context, node.value.params, node.value.body);
      },

      FunctionDeclaration(node) {
        if (isReactComponent(node)) return;
        analyzeFunction(context, node.params, node.body);
      },

      FunctionExpression(node) {
        if (node.parent?.type === "MethodDefinition") return;
        if (isReactComponent(node)) return;
        analyzeFunction(context, node.params, node.body);
      },

      ArrowFunctionExpression(node) {
        if (isReactComponent(node)) return;
        analyzeFunction(context, node.params, node.body);
      },
    };
  },
});
