import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-callback-param.js";

// Note: AssignmentPattern (e.g., `x: any = null`) cannot appear in TSFunctionType
// parameters because default values are a runtime construct. The checkAnyParams
// function handles AssignmentPattern for runtime function signatures, but this
// rule only checks type-level declarations via createNoAnyParamTypeChecker.
ruleTester.run("no-any-callback-param", rule, {
  valid: [
    `function map<A, B>(arr: A[], fn: (item: A) => B): B[] {
  return arr.map(fn);
}`,
    `type Mapper = (item: string) => number;`,
    `interface Transformer {
  transform(data: unknown): void;
}`,
    `declare function process(fn: (input: boolean) => void): void;`,
    `type Handler = (event: { type: string }) => void;`,
    `type Callable = { (item: string): void };`,
    `type Handler = (item: string | null) => void;`,
  ],
  invalid: [
    {
      code: `function badMap<T>(arr: T[], fn: (item: any) => any): any[] {
  return arr.map(fn);
}`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `type BadMapper = (item: any) => string;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `interface BadTransformer {
  transform(data: any): void;
}`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `declare function badProcess(fn: (input: any) => void): void;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `type Callable = { (item: any): void };`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `type Handler = (item: string | any) => void;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `type Handler = (items: any[]) => void;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      code: `type Handler = (data: Array<any>) => void;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
    {
      // Verifies the getText fallback for non-Identifier params (ObjectPattern) in checkAnyParams.
      code: `type Handler = ({ value }: any) => void;`,
      errors: [{ messageId: "anyCallbackParam" }],
    },
  ],
});
