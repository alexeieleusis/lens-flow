import { createRule } from "../utils/rule-creator.js";
import type { TSESLint } from "@typescript-eslint/utils";

function getObjectKeys(objExpr: unknown): string[] {
  const props = (objExpr as { properties: unknown[] }).properties || [];
  const keys: string[] = [];
  for (const p of props) {
    const prop = p as {
      type: string;
      key: { type: string; name?: string; value?: string };
    };
    if (prop.type === "Property") {
      if (prop.key.type === "Identifier" && prop.key.name !== undefined) {
        keys.push(prop.key.name);
      } else if (prop.key.type === "Literal" && prop.key.value !== undefined) {
        keys.push(String(prop.key.value));
      }
    }
  }
  return keys;
}

function findReturnStatements(node: unknown): unknown[] {
  const results: unknown[] = [];
  function walk(n: unknown) {
    if (!n || typeof n !== "object") return;
    const obj = n as Record<string, unknown>;
    if (
      obj.type === "ReturnStatement" &&
      obj.argument != null &&
      (obj.argument as { type?: string }).type === "ObjectExpression"
    ) {
      results.push(obj);
    }
    for (const key of Object.keys(obj)) {
      if (key === "parent") continue;
      const child = obj[key];
      if (Array.isArray(child)) {
        child.forEach(walk);
      } else {
        walk(child);
      }
    }
  }
  walk(node);
  return results;
}

export default createRule({
  name: "no-leaky-factory-return-t59",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow factory functions returning object literals with properties beyond their declared interface",
    },
    messages: {
      leakyReturn:
        "Factory function returns object with extra properties {{extraProps}} not declared in interface {{interfaceName}}. Use `as {{interfaceName}}` cast to hide implementation details. See: https://raw.githubusercontent.com/jpablo/vibe-types/refs/heads/main/plugin/skills/typescript/catalog/T59-existential-types.md",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"leakyReturn", []>) {
    const interfaces = new Map<string, Set<string>>();
    const sourceCode = context.sourceCode;

    function collectInterfaces(node: unknown) {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "TSInterfaceDeclaration" && (n.id as { type?: string }).type === "Identifier") {
        const name = (n.id as { name: string }).name;
        const props = new Set<string>();
        for (const member of (n.body as { body?: unknown[] })?.body || []) {
          if (
            (member as { type: string }).type === "TSPropertySignature" &&
            (member as { key: { type: string; name?: string } }).key
              .type === "Identifier"
          ) {
            props.add(
              (
                member as { key: { type: string; name: string } }
              ).key.name
            );
          }
        }
        interfaces.set(name, props);
      }
      for (const key of Object.keys(n)) {
        if (key === "parent") continue;
        const child = n[key];
        if (Array.isArray(child)) {
          child.forEach(collectInterfaces);
        } else {
          collectInterfaces(child);
        }
      }
    }

    collectInterfaces(sourceCode.ast);

    function checkFunction(fnNode: Record<string, unknown>) {
      const returnTypeAnn = (fnNode.returnType as
        | { typeAnnotation: { type: string; typeName?: { type: string; name: string } } }
        | undefined)?.typeAnnotation;
      if (returnTypeAnn?.type !== "TSTypeReference") return;
      if (returnTypeAnn.typeName?.type !== "Identifier") return;

      const interfaceName = returnTypeAnn.typeName.name;
      const ifaceProps = interfaces.get(interfaceName);
      if (!ifaceProps) return;

      const body = fnNode.body as { type?: string } | undefined;

      if ((body as { type?: string }).type === "BlockStatement") {
        const returns = findReturnStatements(fnNode.body);
        for (const ret of returns) {
          const retObj = ret as { argument: unknown };
          const objExpr = retObj.argument;
          if (!objExpr || (objExpr as { type: string }).type !== "ObjectExpression")
            continue;

          const objKeys = getObjectKeys(objExpr);
          const extraProps = objKeys.filter((k) => !ifaceProps.has(k));
          if (extraProps.length > 0) {
            context.report({
              node: ret as never,
              messageId: "leakyReturn",
              data: {
                extraProps: extraProps.join(", "),
                interfaceName,
              },
            });
          }
        }
      } else if ((body as { type?: string }).type === "ObjectExpression") {
        const objKeys = getObjectKeys(body);
        const extraProps = objKeys.filter((k) => !ifaceProps.has(k));
        if (extraProps.length > 0) {
          context.report({
            node: body as never,
            messageId: "leakyReturn",
            data: {
              extraProps: extraProps.join(", "),
              interfaceName,
            },
          });
        }
      }
    }

    return {
      FunctionDeclaration(node) {
        checkFunction(node as unknown as Record<string, unknown>);
      },
      FunctionExpression(node) {
        checkFunction(node as unknown as Record<string, unknown>);
      },
      ArrowFunctionExpression(node) {
        checkFunction(node as unknown as Record<string, unknown>);
      },
    };
  },
});
