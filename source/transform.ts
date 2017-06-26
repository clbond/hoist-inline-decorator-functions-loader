import {
  ArrowFunction,
  EmitHint,
  FunctionBody,
  FunctionExpression,
  FunctionDeclaration,
  Node,
  Program,
  ScriptKind,
  ScriptTarget,
  SourceFile,
  SyntaxKind,
  TransformationContext,
  createIdentifier,
  createPrinter,
  createSourceFile,
  visitNode,
  visitEachChild,
  transform
} from 'typescript';

import {EOL} from 'os';

const printer = createPrinter();

let checksumState = 0;

const selectors = new Map<string, [string, string]>();

const checksum = (functionContent: string): string => {
  for (let i = 0; i < functionContent.length; ++i) {
    checksumState = (((((checksumState >>> 1) + ((checksumState & 1) << 15)) | 0) + (functionContent.charCodeAt(i) & 0xff)) & 0xffff) | 0;
  }

  return checksumState.toString(16);
};

const print = (node): string => printer.printNode(EmitHint.Unspecified, node, node.getSourceFile());

const createSelectorFunction = (node): string => {
  switch (node.kind) {
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.ArrowFunction:
    case SyntaxKind.FunctionDeclaration:
      break;
    default:
      throw new Error(`Invalid function node type ${SyntaxKind[node.kind]}`);
  }

  if (node.parameters == null || node.parameters.length !== 1) {
    throw new Error(`Invalid state selector function: ${print(node)}`);
  }

  const argument = node.parameters[0].name.text;

  const functionContent = print(node.body);

  const functionId = `stateSelector_${checksum(functionContent)}`;

  selectors.set(functionId, [argument, functionContent]);

  return functionId;
};

const transformer = <T extends Node>(context: TransformationContext) =>
  (rootNode: T) => {
    const visitDecoratorCall = (node: Node): Node => {
      switch (node.kind) {
        case SyntaxKind.FunctionExpression:
        case SyntaxKind.ArrowFunction:
        case SyntaxKind.FunctionDeclaration:
          return createIdentifier(createSelectorFunction(node));
        default:
          return node;
      }
    };

    const visitDecorator = (node: Node): Node => {
      switch (node.kind) {
        case SyntaxKind.CallExpression:
          return visitEachChild(node, visitDecoratorCall, context);
        default:
          return node;
      }
    };

    const visit = (node: Node): Node => {
      switch (node.kind) {
        case SyntaxKind.Decorator:
          return visitEachChild(node, visitDecorator, context);
        default:
          return visitEachChild(node, visit, context);
      }
    };

    return visitNode(rootNode, visit);
  };

const defineSelectors = () => {
  const declarations = new Array<string>();

  for (const [k, [arg, func]] of Array.from(selectors.entries())) {
    declarations.push(
`export function ${k}(${arg}) {
  return ${func};
}`);
  }

  return declarations.join(EOL + EOL);
};

export const transformFile = (filename: string, source: string): string => {
  selectors.clear();

  const sourceFile = createSourceFile(filename, source, ScriptTarget.Latest, true, ScriptKind.TS);

  const transformResult = transform(sourceFile, [transformer]);
  if (transformResult == null ||
      transformResult.transformed == null ||
      transformResult.transformed.length === 0) {
    throw new Error(`Failed to transform code: ${source}`);
  }

  const transformedFile = transformResult.transformed[0] as SourceFile;

  return `${defineSelectors()}${EOL}${EOL}${printer.printFile(transformedFile)}`;
};