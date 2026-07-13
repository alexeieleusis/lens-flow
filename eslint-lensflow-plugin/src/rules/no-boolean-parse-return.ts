import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

export default createRule({
  name: "no-boolean-parse-return",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow parse/validate/check functions that return bare boolean instead of a typed Result with error details",
    },
    messages: {
      booleanParseReturn:
        "Function `{{name}}` returns `boolean` instead of a typed `Result<T, E>`. Callers can't distinguish failure reasons or recover the parsed value. Return `Result<T, E>` instead. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/usecases/UC08-error-handling.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"booleanParseReturn", []>) {
    const NAME_PATTERN = /^(parse|validate|check|parseAndValidate)(?![a-z])/;

    // Stack of enclosing VariableDeclarator identifiers so we can derive the function name
    // from the variable when the function itself has no id (arrows, anonymous FE).
    // Using a stack handles nested VariableDeclarators with destructuring patterns correctly.
    const declaratorIds: (TSESTree.Identifier | undefined)[] = [];

    function checkFunction(node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression) {
      // Prefer the function's own id (FunctionDeclaration, named FunctionExpression).
      // Fall back to the enclosing VariableDeclarator's id (arrow, anonymous FE).
      const nameNode =
        node.type === "FunctionDeclaration"
          ? node.id
          : node.type === "FunctionExpression" && node.id
            ? node.id
            : declaratorIds[declaratorIds.length - 1];

      if (!nameNode) return;
      if (!NAME_PATTERN.test(nameNode.name)) return;

      const returnType = node.returnType?.typeAnnotation;
      if (returnType?.type === "TSBooleanKeyword") {
        context.report({
          node: nameNode,
          messageId: "booleanParseReturn",
          data: { name: nameNode.name },
        });
      }
    }

    function checkTypedSignature(
      nameNode: TSESTree.Identifier | TSESTree.Literal | TSESTree.PrivateIdentifier | null | undefined,
      returnType: TSESTree.TypeNode | undefined
    ) {
      if (!nameNode) return;
      if (nameNode.type !== "Identifier" && nameNode.type !== "Literal" && nameNode.type !== "PrivateIdentifier") return;
      const name = nameNode.type === "Identifier" ? nameNode.name : nameNode.type === "Literal" ? String(nameNode.value ?? "") : nameNode.name;
      if (!NAME_PATTERN.test(name)) return;
      if (returnType?.type === "TSBooleanKeyword") {
        context.report({
          node: nameNode,
          messageId: "booleanParseReturn",
          data: { name },
        });
      }
    }

    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        declaratorIds.push(node.id.type === "Identifier" ? node.id : undefined);
      },
      "VariableDeclarator:exit"() {
        declaratorIds.pop();
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      // TSDeclareFunction: `declare function check(): boolean;` — name on node.id
      TSDeclareFunction(node: TSESTree.TSDeclareFunction) {
        checkTypedSignature(node.id, node.returnType?.typeAnnotation);
      },
      // TSMethodSignature: `interface P { parse(): boolean; }` — name on node.key
      TSMethodSignature(node: TSESTree.TSMethodSignature) {
        const key = node.key;
        if (key.type === "Identifier" || key.type === "Literal") {
          checkTypedSignature(key, node.returnType?.typeAnnotation);
        }
      },
      // TSFunctionType and TSCallSignatureDeclaration are intentionally NOT visited.
      // These represent anonymous type-level signatures (e.g. `type Fn = () => boolean`
      // or a call signature `interface X { (): boolean; }`). Since there is no stable
      // function name to report on, flagging them would produce noisy or misleading
      // diagnostics. The runtime declaration (FunctionDeclaration, variable assignment,
      // class method) that implements the type is what the rule catches instead.
    };
  },
});
