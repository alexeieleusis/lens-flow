import { ESLintUtils } from "@typescript-eslint/utils";
import type { ParserServices, TSESTree, TSESLint } from "@typescript-eslint/utils";
import type ts from "typescript";

type ParameterCheckCallback = (param: TSESTree.Parameter) => void;

export type MutableArrayParam = {
  node: TSESTree.Parameter;
  paramName: string;
  typeText: string;
  elemText: string;
};

export function checkMutableArrayParam(
  param: TSESTree.Parameter,
  sourceCode: TSESLint.SourceCode,
): MutableArrayParam | null {
  const inner = param.type === "TSParameterProperty" ? param.parameter : param;
  const typeAnn = inner.typeAnnotation?.typeAnnotation;
  if (!typeAnn) return null;

  let paramName = "?";
  if (inner.type === "Identifier") {
    paramName = inner.name;
  }

  if (typeAnn.type === "TSArrayType") {
    return {
      node: param,
      paramName,
      typeText: sourceCode.getText(typeAnn),
      elemText: sourceCode.getText(typeAnn.elementType),
    };
  }

  if (
    typeAnn.type === "TSTypeReference" &&
    typeAnn.typeName.type === "Identifier" &&
    typeAnn.typeName.name === "Array"
  ) {
    const elem =
      typeAnn.typeArguments && typeAnn.typeArguments.params.length > 0
        ? sourceCode.getText(typeAnn.typeArguments.params[0])
        : "T";
    return {
      node: param,
      paramName,
      typeText: sourceCode.getText(typeAnn),
      elemText: elem,
    };
  }

  return null;
}

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
    TSDeclareFunction(node) {
      (node as TSESTree.TSDeclareFunction).params.forEach(checkParam);
    },
    TSFunctionType(node) {
      (node as TSESTree.TSFunctionType).params.forEach(checkParam);
    },
    MethodDefinition(node) {
      const fn = (node as TSESTree.MethodDefinition).value;
      if (fn && fn.body) {
        fn.params.forEach(checkParam);
      }
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
    const parserServices = ESLintUtils.getParserServices(context, true);
    if (!parserServices.program) return {};
    const program = parserServices.program;

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
