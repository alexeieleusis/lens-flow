import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-ts-ignore.js";

ruleTester.run("no-ts-ignore", rule, {
  valid: [
    `// @ts-expect-error — TODO: fix in next major
const fixed = doSomething();`,
    `// some regular comment
const x = 1;`,
    `// @ts-check
const y = 2;`,
  ],
  invalid: [
    {
      code: `// @ts-ignore
const broken = doSomething();`,
      errors: [{ messageId: "preferExpectError" }],
    },
    {
      code: `/* @ts-ignore */
const x = doSomething();`,
      errors: [{ messageId: "preferExpectError" }],
    },
    {
      code: `/* @ts-ignore */ const x = doSomething();`,
      errors: [{ messageId: "preferExpectError" }],
    },
    {
      code: `function foo() {
  // @ts-ignore
  return unsafeCall();
}
function bar() {
  // @ts-ignore
  return anotherUnsafeCall();
}`,
      errors: [
        { messageId: "preferExpectError" },
        { messageId: "preferExpectError" },
      ],
    },
  ],
});
