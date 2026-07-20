import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-function-type.js";

ruleTester.run("no-function-type", rule, {
  valid: [
    `type Fn = (x: number) => string;`,
    `function register(fn: (event: MouseEvent) => void) { /* ... */ }`,
    `type Callback = () => void;`,
    `const handler: (data: string) => boolean = (data) => data.length > 0;`,
  ],
  invalid: [
    {
      code: `type Fn = Function;`,
      errors: [{ messageId: "noFunctionType" }],
    },
    {
      code: `function register(fn: Function) { /* ... */ }`,
      errors: [{ messageId: "noFunctionType" }],
    },
    {
      code: `type Handlers = { click: Function; hover: Function };`,
      errors: [{ messageId: "noFunctionType" }, { messageId: "noFunctionType" }],
    },
    {
      code: `type MaybeFn = Function | null;`,
      errors: [{ messageId: "noFunctionType" }],
    },
    {
      code: `type Combined = Function & { tag: string };`,
      errors: [{ messageId: "noFunctionType" }],
    },
    {
      code: `type FnArray = Array<Function>;`,
      errors: [{ messageId: "noFunctionType" }],
    },
    {
      code: `type FnMap = Map<string, Function>;`,
      errors: [{ messageId: "noFunctionType" }],
    },
  ],
});
