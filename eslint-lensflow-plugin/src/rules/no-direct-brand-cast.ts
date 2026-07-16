import ts from "typescript";
import { ESLintUtils, type TSESTree, TSESLint } from "@typescript-eslint/utils";
import { createRule } from "../utils/rule-creator.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T26-refinement-types.md");

const SMART_CONSTRUCTOR_RE = /^(parse[A-Z]|tryParse|mustParse)/;

const PRIMITIVE_NAMES = new Set(["string", "number", "boolean"]);

function isBrandedPrimitiveType(
  checker: ts.TypeChecker,
  tsType: ts.Type,
): { branded: boolean; basePrimitive: ts.Type | undefined } {
  const apparent = checker.getApparentType(tsType);

  const constituents = (apparent as ts.IntersectionType)?.types;
  if (!constituents || constituents.length < 2) {
    return { branded: false, basePrimitive: undefined };
  }

  let basePrimitive: ts.Type | undefined;
  let hasBrandObject = false;

  for (const constituent of constituents) {
    const typeStr = checker.typeToString(constituent).trim();
    const lowerStr = typeStr.toLowerCase().replace(/^["']|["']$/g, "");

    if (!basePrimitive && PRIMITIVE_NAMES.has(lowerStr)) {
      basePrimitive = constituent;
    }

    if ((constituent.flags & ts.TypeFlags.Object) !== 0) {
      const props = (constituent as ts.ObjectType).getProperties();
      if (
        props.some(
          (p) => {
            const name = p.escapedName.toString().toLowerCase();
            return name.includes("brand");
          },
        )
      ) {
        hasBrandObject = true;
      }
    }
  }

  if (basePrimitive && hasBrandObject) {
    return { branded: true, basePrimitive };
  }

  return { branded: false, basePrimitive: undefined };
}

function isPlainPrimitive(
  checker: ts.TypeChecker,
  sourceType: ts.Type,
  basePrimitive: ts.Type,
): boolean {
  // Must NOT already be branded — e.g. Email as Email is not a raw primitive cast
  if (isBrandedPrimitiveType(checker, sourceType).branded) return false;
  return checker.isTypeAssignableTo(sourceType, basePrimitive);
}

function isNamedSmartConstructor(node: TSESTree.Node): boolean {
  if (
    node.type !== "FunctionDeclaration" &&
    node.type !== "FunctionExpression"
  ) {
    return false;
  }
  const fn = node as TSESTree.FunctionDeclaration | TSESTree.FunctionExpression;
  return fn.id != null && SMART_CONSTRUCTOR_RE.test(fn.id.name);
}

function isArrowSmartConstructor(
  arrow: TSESTree.ArrowFunctionExpression,
  ancestors: TSESTree.Node[],
  index: number,
): boolean {
  const declarator = ancestors[index - 1];
  return (
    declarator?.type === "VariableDeclarator" &&
    declarator.id.type === "Identifier" &&
    SMART_CONSTRUCTOR_RE.test(declarator.id.name)
  );
}

function findEnclosingSmartConstructor(
  context: TSESLint.RuleContext<string, []>,
  node: TSESTree.Node,
): boolean {
  const ancestors = context.sourceCode.getAncestors(node);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];
    if (current.type === "ArrowFunctionExpression") {
      return isArrowSmartConstructor(
        current,
        ancestors,
        i,
      );
    }
    if (isNamedSmartConstructor(current)) return true;
  }
  return false;
}

export default createRule({
  name: "no-direct-brand-cast",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct `as` cast of a raw primitive value to a branded type outside a smart constructor.",
    },
    messages: {
      directBrandCast:
        "Direct `as` cast of raw `{{sourceType}}` to branded type `{{brandType}}` bypasses validation. Use the branded type's smart constructor instead. See: {{url}}",
    },
    schema: [],
    fixable: undefined,
  },
  defaultOptions: [],
  create(context: TSESLint.RuleContext<"directBrandCast", []>) {
    const parserServices = ESLintUtils.getParserServices(context, true);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();

    return {
      TSAsExpression(node) {
        const tsTypeNode = parserServices.esTreeNodeToTSNodeMap.get(
          node.typeAnnotation,
        );
        if (!tsTypeNode) return;

        const castTargetType = checker.getTypeFromTypeNode(
          tsTypeNode as ts.TypeNode,
        );
        const { branded, basePrimitive } = isBrandedPrimitiveType(
          checker,
          castTargetType,
        );
        if (!branded || !basePrimitive) return;

        const sourceType = parserServices.getTypeAtLocation(node.expression);
        if (!isPlainPrimitive(checker, sourceType, basePrimitive)) return;

        if (findEnclosingSmartConstructor(context, node)) return;

        context.report({
          node,
          messageId: "directBrandCast",
          data: {
            sourceType: checker.typeToString(sourceType),
            brandType: checker.typeToString(castTargetType),
            url: URL,
          },
        });
      },
    };
  },
});
