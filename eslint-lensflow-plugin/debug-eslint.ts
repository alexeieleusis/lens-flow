import path from "node:path";
import { ESLintUtils } from "@typescript-eslint/utils";
import * as tsParser from "@typescript-eslint/parser";

const code = `type Milliseconds = number & { readonly __brand: "Milliseconds" };
const a: Milliseconds = 100 as Milliseconds;
const b: Milliseconds = 200 as Milliseconds;
const c = a + b;`;

const result = tsParser.parse(code, {
  ecmaVersion: 2022,
  sourceType: "module",
  project: "./tsconfig.test.json",
  tsconfigRootDir: __dirname,
});

const services = ESLintUtils.parseForESLINT Services(result as any);
