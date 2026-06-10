import ts from "typescript";

const code = `
type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
`;

const sourceFile = ts.createSourceFile("test.ts", code, ts.ScriptTarget.Latest, true);
const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  strict: true,
};

const host = ts.createCompilerHost(compilerOptions);
const origGetSource = host.getSourceFile.bind(host);
host.getSourceFile = (fileName, languageVersion, onError) => 
  fileName === "test.ts" ? sourceFile : origGetSource(fileName, languageVersion, onError);

const program = ts.createProgram(["test.ts"], compilerOptions, host);
const checker = program.getTypeChecker();

sourceFile.forEachChild(function visit(node) {
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (decl.name.getText() === "a") {
        const tsType = checker.getTypeAtLocation(decl);
        const apparent = checker.getApparentType(tsType);
        const constituents = (apparent as ts.IntersectionType).types;
        
        const brandConstituent = constituents[1];
        console.log("Brand constituent typeToString:", checker.typeToString(brandConstituent));
        
        const props = brandConstituent.getProperties();
        console.log("Props length:", props.length);
        
        for (const p of props) {
          console.log("=== Property ===");
          console.log("escapedName:", p.escapedName);
          console.log("typeof escapedName:", typeof p.escapedName);
          console.log("String(escapedName):", String(p.escapedName));
          console.log("escapedName === '__brand':", p.escapedName === "__brand");
          console.log("String(escapedName) === '__brand':", String(p.escapedName) === "__brand");
          console.log("escapedName.toString():", p.escapedName.toString());
          console.log("escapedName.toString() === '__brand':", p.escapedName.toString() === "__brand");
          
          // Check symbol details
          console.log("p.name:", p.name);
          console.log("p.flags:", p.flags);
          console.log("p.valueDeclaration:", p.valueDeclaration?.getText?.());
        }
      }
    }
  }
});
