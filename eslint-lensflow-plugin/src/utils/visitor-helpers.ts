import { ESLintUtils } from "@typescript-eslint/utils";
import type { ParserServices, TSESTree, TSESLint } from "@typescript-eslint/utils";
import type ts from "typescript";

type ParameterCheckCallback = (param: TSESTree.Parameter) => void;

export function createFunctionParamVisitor(
  checkParam: ParameterCheckCallback,
): Record<string, (node: TSESTree.Node) => void> {
  return {
    FunctionDeclaration(node) {
      (node as TSESTree.FunctionDeclaration).params.forEach(checkParam);
    },
    FunctionExpression(node) {
      (node as TSESTree.FunctionExpression).params.forEach(checkParam);
    },
    ArrowFunctionExpression(node) {
      (node as TSESTree.ArrowFunctionExpression).params.forEach(checkParam);
    },
    TSMethodSignature(node) {
      (node as TSESTree.TSMethodSignature).params.forEach(checkParam);
    },
  };
}

export function getInterfaceMembers(
  node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
): TSESTree.TypeElement[] {
  if (node.type === "TSInterfaceBody") {
    return node.body;
  }
  return node.members;
}

type BooleanFlagMember = TSESTree.TSPropertySignature & {
  key: TSESTree.Identifier;
  typeAnnotation: { typeAnnotation: TSESTree.TypeNode };
};

type FlagCheckReportData = {
  count: string;
  flags: string;
  kind: string;
};

export function createBooleanFlagChecker(
  minCount: number,
  memberFilter: (member: TSESTree.TypeElement) => member is BooleanFlagMember,
  messageId: string,
): (context: TSESLint.RuleContext<string, unknown[]>) => Record<string, (node: TSESTree.Node) => void> {
  return (context) => {
    function checkNode(
      node: TSESTree.TSInterfaceBody | TSESTree.TSTypeLiteral,
    ) {
      const members = getInterfaceMembers(node);
      const boolFlags = members.filter(memberFilter);

      if (boolFlags.length >= minCount) {
        const flagNames = boolFlags
          .map((m) => (m.key.type === "Identifier" ? m.key.name : "?"))
          .join(", ");

        const parent = node.parent;
        let kind: string;
        if (parent?.type === "TSInterfaceDeclaration") {
          kind = `interface \`${parent.id?.name ?? "anonymous"}\``;
        } else if (parent?.type === "TSTypeAliasDeclaration") {
          kind = `type \`${parent.id?.name ?? "anonymous"}\``;
        } else {
          kind = "type";
        }

        context.report({
          node: parent ?? node,
          messageId,
          data: {
            count: String(boolFlags.length),
            flags: flagNames,
            kind,
          } as FlagCheckReportData,
        });
      }
    }

    return {
      TSInterfaceBody(node: TSESTree.TSInterfaceBody) {
        checkNode(node);
      },
      TSTypeLiteral(node: TSESTree.TSTypeLiteral) {
        checkNode(node);
      },
    } as Record<string, (node: TSESTree.Node) => void>;
  };
}

type FunctionBodyVisitorCheckFn = (
  body: TSESTree.BlockStatement,
  checker: ts.TypeChecker,
  esTreeNodeToTSNodeMap: ParserServices["esTreeNodeToTSNodeMap"],
  context: TSESLint.RuleContext<string, unknown[]>,
) => void;

export function createFunctionBodyVisitor(
  checkBody: FunctionBodyVisitorCheckFn,
): (context: TSESLint.RuleContext<string, unknown[]>) => Record<string, (node: TSESTree.Node) => void> {
  return (context): Record<string, (node: TSESTree.Node) => void> => {
    const parserServices = ESLintUtils.getParserServices(context);
    const program = parserServices.program;
    if (!program) return {};

    const checker = program.getTypeChecker();
    const esTreeNodeToTSNodeMap = parserServices.esTreeNodeToTSNodeMap;

    function checkNodeBody(body: TSESTree.BlockStatement) {
      checkBody(body, checker, esTreeNodeToTSNodeMap, context);
    }

    function visitFn(
      node:
        | TSESTree.FunctionDeclaration
        | TSESTree.FunctionExpression
        | TSESTree.ArrowFunctionExpression,
    ) {
      if (node.body.type === "BlockStatement") {
        checkNodeBody(node.body);
      }
    }

    return {
      FunctionDeclaration: visitFn,
      FunctionExpression: visitFn,
      ArrowFunctionExpression: visitFn,
    } as Record<string, (node: TSESTree.Node) => void>;
  };
}
