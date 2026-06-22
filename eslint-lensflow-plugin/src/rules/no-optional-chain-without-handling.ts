import ts from "typescript";
import { ESLintUtils, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";

function typeIncludesUndefined(type: ts.Type): boolean {
  if ((type.flags & ts.TypeFlags.Undefined) !== 0) return true;
  if ((type.flags & ts.TypeFlags.Any) !== 0) return false;
  if (type.isUnion()) {
    return type.types.some(typeIncludesUndefined);
  }
  return false;
}

export default createRule({
  name: "no-optional-chain-without-handling",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow optional chaining (`?.`) without handling the undefined case via `??` (in variable declarations)",
     },
    messages: {
      bareOptionalChain:
        "Optional chaining may produce `undefined`. Handle it with `??` or a fallback value. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T13-null-safety.md",
      undefinedType:
        "The type of `{{name}}` includes `undefined` from optional chaining. Use `??` to provide a default. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T13-null-safety.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"undefinedType" | "bareOptionalChain", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};
    const checker = program.getTypeChecker();

    return {
      VariableDeclarator(node) {
        if (!node.init) return;

        const init = node.init;

        if (init.type !== "ChainExpression") return;

        const parent = init.parent;
        if (
          parent?.type === "LogicalExpression" &&
          parent.operator === "??"
        ) {
          return;
        }

        const declName =
          node.id.type === "Identifier" ? node.id.name : "<pattern>";

        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(init);
        if (!tsNode) return;
        const type = checker.getTypeAtLocation(tsNode);
        const hasUndefined = typeIncludesUndefined(type);

        if (hasUndefined) {
          context.report({
            node,
            messageId: "undefinedType",
            data: { name: declName },
          });
        } else {
          context.report({
            node,
            messageId: "bareOptionalChain",
          });
        }
      },
    };
  },
});
