import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import { knowledgeUrl } from "../utils/knowledge-url.js";
import {
  isUsedAsInputInBody,
  isUsedAsOutputInBody,
} from "../utils/variance-checker.js";

const URL = knowledgeUrl("catalog/T08-variance-subtyping.md");

export default createRule({
  name: "no-unnecessary-invariance",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type parameters marked `in out` when the type only appears in output or input positions",
    },
    messages: {
      onlyOutput:
        "Type parameter `{{name}}` is marked `in out` but only appears in output positions. Change `in out` to `out`. See: {{url}}",
      onlyInput:
        "Type parameter `{{name}}` is marked `in out` but only appears in input positions. Change `in out` to `in`. See: {{url}}",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"onlyOutput" | "onlyInput", []>) {
    function checkDeclaration(
      node: TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration,
    ): void {
      const typeParams = node.typeParameters;
      if (!typeParams) return;

      let body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral;
      if (node.type === "TSInterfaceDeclaration") {
        if (!node.body) return;
        body = node.body;
      } else {
        if (node.typeAnnotation.type !== "TSTypeLiteral") return;
        body = node.typeAnnotation;
      }

      for (const tp of typeParams.params) {
        if (!tp.in || !tp.out) continue;

        const paramName = tp.name.name;

        const inOutput = isUsedAsOutputInBody(body, paramName);
        const inInput = isUsedAsInputInBody(body, paramName);

        if (inOutput && !inInput) {
          context.report({
            node: tp,
            messageId: "onlyOutput",
            data: { name: paramName, url: URL },
          });
        } else if (inInput && !inOutput) {
          context.report({
            node: tp,
            messageId: "onlyInput",
            data: { name: paramName, url: URL },
          });
        }
      }
    }

    return {
      TSInterfaceDeclaration(node) {
        checkDeclaration(node);
      },
      TSTypeAliasDeclaration(node) {
        checkDeclaration(node);
      },
    };
  },
});
