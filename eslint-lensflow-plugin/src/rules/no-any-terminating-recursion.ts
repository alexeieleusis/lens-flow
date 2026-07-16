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
      if (
        (node.typeName.type === "Identifier" && node.typeName.name === declName) ||
        (node.typeName.type === "TSQualifiedName" && node.typeName.right.name === declName)
      ) {
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

function getParamTypeAnnotation(param: TSESTree.Node): TSESTree.TSTypeAnnotation | null {
  // Unwrap RestElement (...args, ...{a}, ...x = "default")
  let p = param;
  if (p.type === "RestElement") {
    p = (p as TSESTree.RestElement).argument;
  }
  // Check for typeAnnotation on the param itself (Identifier, ObjectPattern, ArrayPattern, RestElement)
  if ((p as any).typeAnnotation) return (p as any).typeAnnotation;
  // AssignmentPattern: the annotation is on the left side (x: T = "default")
  if (p.type === "AssignmentPattern") {
    const left = p.left;
    if (left.typeAnnotation) return left.typeAnnotation;
  }
  return null;
}

function checkParamsAndReturnType(
  declName: string,
  params: readonly TSESTree.Node[],
  returnType: TSESTree.TSTypeAnnotation | undefined
): boolean {
  for (const param of params) {
    const typeAnn = getParamTypeAnnotation(param);
    if (typeAnn && isSelfReferential(declName, typeAnn.typeAnnotation)) {
      return true;
    }
  }
  if (returnType && isSelfReferential(declName, returnType.typeAnnotation)) {
    return true;
  }
  return false;
}

function isSelfReferentialInMember(declName: string, member: TSESTree.Node): boolean {
  if (member.type === "TSPropertySignature") {
    const sig = member as TSESTree.TSPropertySignature;
    if (sig.typeAnnotation) {
      return isSelfReferential(declName, sig.typeAnnotation.typeAnnotation);
    }
    return false;
  }

  if (member.type === "TSMethodSignature") {
    return checkParamsAndReturnType(declName, member.params, member.returnType);
  }

  if (member.type === "TSCallSignatureDeclaration") {
    return checkParamsAndReturnType(declName, member.params, member.returnType);
  }

  if (member.type === "TSConstructSignatureDeclaration") {
    return checkParamsAndReturnType(declName, member.params, member.returnType);
  }

  return false;
}

function checkCallSignatureForAny(sig: TSESTree.TSCallSignatureDeclaration | TSESTree.TSConstructSignatureDeclaration): AnyOrUnknownNode[] {
  const results: AnyOrUnknownNode[] = [];
  for (const param of sig.params) {
    const typeAnn = getParamTypeAnnotation(param);
    if (typeAnn) {
      results.push(findAnyOrUnknown(typeAnn.typeAnnotation));
    }
  }
  if (sig.returnType) {
    results.push(findAnyOrUnknown(sig.returnType.typeAnnotation));
  }
  return results;
}

function checkMethodSignatureForAny(sig: TSESTree.TSMethodSignature): AnyOrUnknownNode[] {
  const results: AnyOrUnknownNode[] = [];
  for (const param of sig.params) {
    const typeAnn = getParamTypeAnnotation(param);
    if (typeAnn) {
      results.push(findAnyOrUnknown(typeAnn.typeAnnotation));
    }
  }
  if (sig.returnType) {
    results.push(findAnyOrUnknown(sig.returnType.typeAnnotation));
  }
  return results;
}

function findAnyOrUnknownInInterfaceBody(body: TSESTree.TSInterfaceBody): AnyOrUnknownNode[] {
  const results: AnyOrUnknownNode[] = [];
  for (const m of body.body) {
    if (m.type === "TSPropertySignature" && m.typeAnnotation) {
      results.push(findAnyOrUnknown(m.typeAnnotation.typeAnnotation));
    } else if (m.type === "TSMethodSignature") {
      results.push(...checkMethodSignatureForAny(m));
    } else if (m.type === "TSCallSignatureDeclaration") {
      results.push(...checkCallSignatureForAny(m));
    } else if (m.type === "TSConstructSignatureDeclaration") {
      results.push(...checkCallSignatureForAny(m));
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
      anyInRecursive: "Found `{{keyword}}` inside a self-referential recursive type. Replace with a concrete type to preserve type safety. See: https://raw.githubusercontent.com/jpablo/vibe-types/7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/catalog/T61-recursive-types.md",
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
