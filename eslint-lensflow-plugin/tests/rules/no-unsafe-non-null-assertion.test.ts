import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unsafe-non-null-assertion.js";

ruleTester.run("no-unsafe-non-null-assertion", rule, {
  valid: [
    {
      code: `function render(name: string) {
  return \`<h1>\${name.toUpperCase()}</h1>\`;
}`,
    },
    {
      code: `function render(name: string | null) {
  if (!name) return "";
  return \`<h1>\${name.toUpperCase()}</h1>\`;
}`,
    },
    {
      code: `function useAfterGuard(x: string | null) {
  if (x === null) return;
  return x!.toUpperCase();
}`,
    },
    {
      code: `function useAfterUndefinedGuard(x: string | undefined) {
  if (x === undefined) return;
  return x!.length;
}`,
    },
  ],
  invalid: [
    {
      code: `function render(name: string | null) {
  return \`<h1>\${name!.toUpperCase()}</h1>\`;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      code: `function getValue(x: number | undefined) {
  return x! * 2;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      code: `function maybeUse(val: string | null | undefined) {
  return val!.length;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      code: `const fn = (x: string | null) => x!.toUpperCase();`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      code: `const x: null = null;
const y = x!;`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
    {
      code: `function process(val: (string | null)) {
  return val!.length;
}`,
      errors: [{ messageId: "unsafeNonNull" }],
    },
  ],
});
