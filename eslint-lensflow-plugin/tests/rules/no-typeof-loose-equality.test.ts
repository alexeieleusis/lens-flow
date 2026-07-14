import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-typeof-loose-equality.js";

ruleTester.run("no-typeof-loose-equality", rule, {
  valid: [
    `function describe(x: string | number) {
  if (typeof x === "string") {
    console.log(x.toUpperCase());
  }
}`,
    `function check(x: unknown) {
  if (typeof x !== "function") {
    return true;
  }
}`,
    `const a = 1 == 1;`,
    `if (x == "string") { }`,
  ],
  invalid: [
    {
      code: `function describe(x: string | number) {
  if (typeof x == "string") {
    console.log(x.toUpperCase());
  }
}`,
      errors: [{ messageId: "looseTypeofEq" }],
      output: `function describe(x: string | number) {
  if (typeof x === "string") {
    console.log(x.toUpperCase());
  }
}`,
    },
    {
      code: `function check(x: unknown) {
  if (typeof x != "function") {
    return true;
  }
}`,
      errors: [{ messageId: "looseTypeofNeq" }],
      output: `function check(x: unknown) {
  if (typeof x !== "function") {
    return true;
  }
}`,
    },
    {
      code: `if ("string" == typeof x) { }`,
      errors: [{ messageId: "looseTypeofEq" }],
      output: `if ("string" === typeof x) { }`,
    },
    {
      code: `if (10 != typeof x) { }`,
      errors: [{ messageId: "looseTypeofNeq" }],
      output: `if (10 !== typeof x) { }`,
    },
  ],
});
