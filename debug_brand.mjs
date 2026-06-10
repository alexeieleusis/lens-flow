import { ESLintUtils } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";
import ts from "typescript";
import { Linter } from "eslint";

const code = `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;`;

const rule = {
  meta: { type: "problem", schema: [], messages: {} },
  defaultOptions: [],
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator !== "+") return;
        const parserServices = ESLintUtils.getParserServices(context);
        const checker = parserServices.program.getTypeChecker();
        
        const leftType = parserServices.getTypeAtLocation(node.left);
        const apparent = checker.getApparentType(leftType);
        
        console.log("=== LEFT TYPE ===");
        console.log("flags:", leftType.flags, "Intersection:", (leftType.flags & ts.TypeFlags.Intersection) !== 0);
        console.log("typeToString:", checker.typeToString(leftType));
        console.log("constructor:", leftType.constructor.name);
        
        console.log("\n=== APPARENT ===");
        console.log("flags:", apparent.flags, "Intersection:", (apparent.flags & ts.TypeFlags.Intersection) !== 0);
        console.log("typeToString:", checker.typeToString(apparent));
        console.log("constructor:", apparent.constructor.name);
        console.log("has types prop:", "types" in apparent);
        
        if (apparent.types) {
          console.log("\n=== CONSTITUENTS ===");
          console.log("count:", apparent.types.length);
          for (let i = 0; i < apparent.types.length; i++) {
            const c = apparent.types[i];
            console.log(`${i}: flags=${c.flags}, isNum=${(c.flags & ts.TypeFlags.Number) !== 0}, toString=${checker.typeToString(c)}`);
            const props = c.getProperties();
            console.log(`   props: ${props.map(p => String(p.escapedName))}`);
          }
        } else {
          console.log("NO types property on apparent!");
        }
      },
    };
  },
};

const linter = new Linter();
linter.defineParser("@typescript-eslint/parser", tsParser);
linter.defineRule("debug-rule", rule);

linter.verify(code, {
  files: ["**/*.ts"],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: "./tsconfig.test.json",
      tsconfigRootDir: process.cwd(),
    },
  },
  rules: { "debug-rule": "error" },
}, { filename: "test.ts" });
