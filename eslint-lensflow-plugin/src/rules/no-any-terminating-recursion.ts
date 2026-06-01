import { TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { getChildren } from "../utils/ast-helpers.js";

type AnyOrUnknownNode = TSESTree.TSAnyKeyword | TSESTree.TSUnknownKeyword | null;

function findAnyOrUnknown(node: TSESTree.Node): AnyOrUnknownNode {
  if (node.type === "TSAnyKeyword" || node.type === "TSUnknownKeyword") {
    return node;
  }

  for (const child of getChildren(node)) {
    const found = findAnyOrUnknown(child);
    if (found) return found;
  }
  return null;
}

function isSelfReferential(declName: string, typeNode: TSESTree.TypeNode): boolean {
  function check(node: TSESTree.Node): boolean {
    if (node.type === "TSTypeReference") {
      if (node.typeName.type === "Identifier" && node.typeName.name === declName) {
        return true;
      }
    }

    for (const child of getChildren(node)) {
      if (check(child)) return true;
    }
    return false;
  }

  return check(typeNode);
}

function isInterfaceSelfReferential(declName: string, body: TSESTree.TSInterfaceBody): boolean {
  for (const member of body.body) {
    if (isSelfReferentialInMember(declName, member)) {
      return true;
    }
  }
  return false;
}

function isSelfReferentialInMember(declName: string, member: TSESTree.Node): boolean {
  if (member.type === "TSPropertySignature") {
    const sig = member as TSESTree.TSPropertySignature;
    if (sig.typeAnnotation) {
      return isSelfReferential(declName, sig.typeAnnotation.typeAnnotation);
    }
  }

  if (member.type !== "TSMethodSignature") return false;
  const method = member as TSESTree.TSMethodSignature;

  for (const param of method.params) {
    const p = param as TSESTree.Identifier | TSESTree.RestElement;
    if (p.typeAnnotation && isSelfReferential(declName, p.typeAnnotation.typeAnnotation)) {
      return true;
    }
  }

  if (method.returnType && isSelfReferential(declName, method.returnType.typeAnnotation)) {
    return true;
  }

  return false;
}

function findAnyOrUnknownInInterfaceBody(body: TSESTree.TSInterfaceBody): AnyOrUnknownNode[] {
  const results: AnyOrUnknownNode[] = [];
  for (const m of body.body) {
    if (m.type === "TSPropertySignature" && m.typeAnnotation) {
      results.push(findAnyOrUnknown(m.typeAnnotation.typeAnnotation));
    } else if (m.type === "TSMethodSignature") {
      for (const param of m.params) {
        const p = param as TSESTree.Identifier | TSESTree.RestElement;
        if (p.typeAnnotation) {
          results.push(findAnyOrUnknown(p.typeAnnotation.typeAnnotation));
        }
      }
      if (m.returnType) {
        results.push(findAnyOrUnknown(m.returnType.typeAnnotation));
      }
    }
  }
  return results;
}

export default createRule({
  name: "no-any-terminating-recursion",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `any` or `unknown` inside self-referential recursive types, which defeats type-safe recursion.",
    },
    messages: {
      anyInRecursive: "Found `{{keyword}}` inside a self-referential recursive type. Replace with a concrete type to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T61-recursive-types.md",
    },
    fixable: undefined,
    schema: [],
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"anyInRecursive", []>) {
    return {
      TSTypeAliasDeclaration(node) {
        const declName = node.id.name;
        if (!isSelfReferential(declName, node.typeAnnotation)) return;

        const found = findAnyOrUnknown(node.typeAnnotation);
        if (found) {
          const keyword = found.type === "TSAnyKeyword" ? "any" : "unknown";
          context.report({
            node: found,
            messageId: "anyInRecursive",
            data: { keyword },
          });
        }
      },

      TSInterfaceDeclaration(node) {
        const declName = node.id.name;
        if (!isInterfaceSelfReferential(declName, node.body)) return;

        for (const f of findAnyOrUnknownInInterfaceBody(node.body)) {
          if (!f) continue;
          const keyword = f.type === "TSAnyKeyword" ? "any" : "unknown";
          context.report({
            node: f,
            messageId: "anyInRecursive",
            data: { keyword },
          });
        }
      },
    };
  },
});
