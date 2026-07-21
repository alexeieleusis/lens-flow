import ts from "typescript";

const code = `
type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;
`;

const sourceFile = ts.createSourceFile(
  "test.ts",
  code,
  ts.ScriptTarget.Latest,
  true,
);
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  strict: true,
  esModuleInterop: true,
};

const host = ts.createCompilerHost(compilerOptions);
const origGetSource = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, onError) =>
  fileName === "test.ts"
    ? sourceFile
    : origGetSource(fileName, languageVersion, onError);

const program = ts.createProgram(["test.ts"], compilerOptions, host);
const checker = program.getTypeChecker();

sourceFile.forEachChild(function visit(node) {
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      const name = decl.name.getText();
      if (name === "a" || name === "b") {
        const tsType = checker.getTypeAtLocation(decl);
        const apparent = checker.getApparentType(tsType);

        console.log("=== Variable:", name, "===");
        console.log("typeToString:", checker.typeToString(tsType));
        console.log("apparentToString:", checker.typeToString(apparent));
        console.log(
          "apparent.flags:",
          apparent.flags,
          "Intersection:",
          apparent.flags === ts.TypeFlags.Intersection,
        );

        const intersection = apparent as ts.IntersectionType;
        const constituents = intersection.types;
        console.log("constituents length:", constituents?.length);

        if (constituents) {
          for (let i = 0; i < constituents.length; i++) {
            const c = constituents[i];
            console.log(`  [${i}] flags:`, c.flags);
            console.log(
              `  [${i}] isNumber:`,
              (c.flags & ts.TypeFlags.Number) !== 0,
            );
            console.log(
              `  [${i}] isObject:`,
              (c.flags & ts.TypeFlags.Object) !== 0,
            );
            const typeStr = checker.typeToString(c).trim();
            console.log(`  [${i}] typeToString: "${typeStr}"`);
            console.log(
              `  [${i}] typeStr.toLowerCase() === "number":`,
              typeStr.toLowerCase() === "number",
            );
            const props = c.getProperties();
            console.log(`  [${i}] props count:`, props.length);
            const brandProps = props.filter((p) => {
              const n = p.escapedName as string;
              return n === "_brand" || n === "__brand" || /Brand$/.test(n);
            });
            console.log(
              `  [${i}] brand props (rule check):`,
              brandProps.map((p) => String(p.escapedName)),
            );
          }
        }

        // Simulate the rule's isBrandedNumber logic
        console.log("\n--- Simulating isBrandedNumber ---");
        let hasNumber = false;
        let hasBrandObj = false;
        if (constituents && constituents.length > 1) {
          for (const constituent of constituents) {
            const typeStr = checker.typeToString(constituent).trim();
            if (
              (constituent.flags & ts.TypeFlags.Number) !== 0 ||
              typeStr.toLowerCase() === "number"
            ) {
              hasNumber = true;
              console.log("Found number constituent");
            } else if (
              constituent.getProperties().some((p) => {
                const n = p.escapedName as string;
                return n === "_brand" || n === "__brand" || /Brand$/.test(n);
              })
            ) {
              hasBrandObj = true;
              console.log("Found brand constituent");
            }
          }
        }
        console.log("hasNumber:", hasNumber, "hasBrandObj:", hasBrandObj);
        console.log(
          "Result (hasNumber && hasBrandObj):",
          hasNumber && hasBrandObj,
        );
      }
    }
  }
});
