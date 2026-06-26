import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  containsTypeRefInOutput,
  isUsedAsInputInBody,
} from "../utils/variance-checker.js";

function hasTypeRefInInput(
  body: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
  paramName: string,
): boolean {
  return isUsedAsInputInBody(body, paramName);
}

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
        "Type parameter `{{name}}` is marked `in out` but only appears in output positions. Change `in out` to `out`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
      onlyInput:
        "Type parameter `{{name}}` is marked `in out` but only appears in input positions. Change `in out` to `in`. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T08-variance-subtyping.md",
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
      let members: TSESTree.TypeElement[];
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        if (!node.body) return;
        body = node.body;
        members = body.body;
      } else {
        const decl = node;
        if (
          decl.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral
        )
          return;
        body = decl.typeAnnotation;
        members = body.members;
      }

      for (const tp of typeParams.params) {
        if (!tp.in || !tp.out) continue;

        const paramName = tp.name.name;

        const inOutput = hasOutputRefInMembers(
          members,
          paramName,
        );
        const inInput = hasTypeRefInInput(body, paramName);

        if (inOutput && !inInput) {
          context.report({
            node: tp,
            messageId: "onlyOutput",
            data: { name: paramName },
          });
        } else if (inInput && !inOutput) {
          context.report({
            node: tp,
            messageId: "onlyInput",
            data: { name: paramName },
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

function hasOutputRefInMembers(
  members: TSESTree.TypeElement[],
  paramName: string,
): boolean {
  for (const member of members) {
    if (checkMemberForOutput(member, paramName)) {
      return true;
    }
  }
  return false;
}

function checkMemberForOutput(
  member: TSESTree.TypeElement,
  paramName: string,
): boolean {
  if (member.type === AST_NODE_TYPES.TSMethodSignature) {
    const m = member as TSESTree.TSMethodSignature;
    const rt = m.returnType?.typeAnnotation;
    if (rt && containsTypeRefInOutput(rt, paramName)) {
      return true;
    }
  } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
    const p = member as TSESTree.TSPropertySignature;
    const ta = p.typeAnnotation?.typeAnnotation;
    if (ta && containsTypeRefInOutput(ta, paramName)) {
      return true;
    }
  } else if (member.type === AST_NODE_TYPES.TSIndexSignature) {
    const ta = member.typeAnnotation?.typeAnnotation;
    if (ta && containsTypeRefInOutput(ta, paramName)) {
      return true;
    }
  } else if (member.type === AST_NODE_TYPES.TSCallSignatureDeclaration) {
    const c = member as TSESTree.TSCallSignatureDeclaration;
    const rt = c.returnType?.typeAnnotation;
    if (rt && containsTypeRefInOutput(rt, paramName)) {
      return true;
    }
  } else if (member.type === AST_NODE_TYPES.TSConstructSignatureDeclaration) {
    const c = member as TSESTree.TSConstructSignatureDeclaration;
    const rt = c.returnType?.typeAnnotation;
    if (rt && containsTypeRefInOutput(rt, paramName)) {
      return true;
    }
  }
  return false;
}
