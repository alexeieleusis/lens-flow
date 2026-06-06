import ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const testDir = "/tmp/branded-test";
fs.mkdirSync(testDir, { recursive: true });
const code = `
type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;
`;
fs.writeFileSync(path.join(testDir, "test.ts"), code);

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  strict: true,
  module: ts.ModuleKind.Node16,
  moduleResolution: ts.ModuleResolutionKind.Node16,
};
const program = ts.createProgram([path.join(testDir, "test.ts")], compilerOptions);
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile(path.join(testDir, "test.ts"))!;

const arithKinds = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

function visit(node: ts.Node) {
  if (ts.isBinaryExpression(node) && arithKinds.has(node.operatorToken.kind)) {
    const leftType = checker.getTypeAtLocation(node.left);
    console.log("=== Left operand type ===");
    console.log("flags:", leftType.flags, "binary:", leftType.flags.toString(2));
    console.log("isIntersection:", (leftType.flags & ts.TypeFlags.Intersection) !== 0);
    console.log("isNumber:", (leftType.flags & ts.TypeFlags.Number) !== 0);
    console.log("toString:", checker.typeToString(leftType));
    
    const apparent = checker.getApparentType(leftType);
    console.log("\n=== Apparent type ===");
    console.log("flags:", apparent.flags, "binary:", apparent.flags.toString(2));
    console.log("isIntersection:", (apparent.flags & ts.TypeFlags.Intersection) !== 0);
    console.log("isNumber:", (apparent.flags & ts.TypeFlags.Number) !== 0);
    console.log("toString:", checker.typeToString(apparent));

    const intersection = apparent as ts.IntersectionType;
    console.log("constituents:", intersection.types?.length);
    if (intersection.types) {
      for (const c of intersection.types) {
        console.log("  constituent flags:", c.flags, "toString:", checker.typeToString(c));
      }
    }
    
    const origIntersection = leftType as ts.IntersectionType;
    console.log("\n=== Original type constituents ===");
    console.log("constituents:", origIntersection.types?.length);
    if (origIntersection.types) {
      for (const c of origIntersection.types) {
        console.log("  constituent flags:", c.flags, "toString:", checker.typeToString(c));
      }
    }
  }
  ts.forEachChild(node, visit);
}
visit(sourceFile);
