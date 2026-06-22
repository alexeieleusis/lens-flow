import { AST_NODE_TYPES } from "@typescript-eslint/types";
import type { TSESTree } from "@typescript-eslint/types";
import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";
import {
  containsTypeRef,
  containsTypeRefInOutput,
  paramTypeAnnotation,
} from "../utils/variance-checker.js";

// --- Input-position walker (parameter types) ---

function checksParamsForTypeRef(
  params: TSESTree.Parameter[],
  paramName: string,
): boolean {
  for (const p of params) {
    const tp = paramTypeAnnotation(p);
    if (tp && containsTypeRef(tp, paramName)) return true;
  }
  return false;
}

function methodHasInputRef(
  member: TSESTree.TSMethodSignature,
  paramName: string,
): boolean {
  return checksParamsForTypeRef(member.params, paramName);
}

function propertyHasInputRef(
  member: TSESTree.TSPropertySignature,
  paramName: string,
): boolean {
  const ta = member.typeAnnotation?.typeAnnotation;
  if (!ta) return false;
  return propTypeHasInput(ta, paramName);
}

function hasTypeRefInInput(
  members: TSESTree.TypeElement[],
  paramName: string,
): boolean {
  for (const member of members) {
    if (member.type === AST_NODE_TYPES.TSMethodSignature) {
      if (methodHasInputRef(member as TSESTree.TSMethodSignature, paramName))
        return true;
    } else if (member.type === AST_NODE_TYPES.TSPropertySignature) {
      if (
        propertyHasInputRef(
          member as TSESTree.TSPropertySignature,
          paramName,
        )
      )
        return true;
    }
  }
  return false;
}

// For property types: function types contribute params as input positions;
// non-function property types are NOT input positions.
function propTypeHasInput(node: TSESTree.Node, paramName: string): boolean {
  if (node.type === AST_NODE_TYPES.TSFunctionType) {
    for (const p of node.params) {
      const tp = paramTypeAnnotation(p);
      if (tp && containsTypeRef(tp, paramName)) return true;
    }
    return false;
  }
  if (node.type === AST_NODE_TYPES.TSConstructorType) {
    for (const p of node.params) {
      const tp = paramTypeAnnotation(p);
      if (tp && containsTypeRef(tp, paramName)) return true;
    }
    return false;
  }
  return false;
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

      let members: TSESTree.TypeElement[];
      if (node.type === AST_NODE_TYPES.TSInterfaceDeclaration) {
        if (!node.body) return;
        members = node.body.body;
      } else {
        const decl = node;
        if (
          decl.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral
        )
          return;
        members = decl.typeAnnotation.members;
      }

      for (const tp of typeParams.params) {
        if (!tp.in || !tp.out) continue;

        const paramName = tp.name.name;

        const inOutput = hasOutputRefInMembers(
          members,
          paramName,
        );
        const inInput = hasTypeRefInInput(members, paramName);

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
  }
  return false;
}
