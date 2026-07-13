import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-keyof-any.js";

ruleTester.run("no-keyof-any", rule, {
  valid: [
    `function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}`,
    `type Keys = keyof string;`,
    `type Props = keyof HTMLDivElement;`,
  ],
  invalid: [
    {
      code: `type Keys = keyof any;`,
      errors: [{ messageId: "keyofAny" }],
    },
    {
      code: `function get<T, K extends keyof any>(obj: T, key: K) {
  return obj[key];
}`,
      errors: [{ messageId: "keyofAny" }],
    },
    {
      code: `type Keys = keyof (any | string);`,
      errors: [{ messageId: "keyofAny" }],
    },
    {
      code: `type K2 = keyof (any & { x: 1 });`,
      errors: [{ messageId: "keyofAny" }],
    },
    {
      code: `type K3 = keyof (any);`,
      errors: [{ messageId: "keyofAny" }],
    },
    {
      code: `type K4 = keyof ((string | any) & { x: 1 });`,
      errors: [{ messageId: "keyofAny" }],
    },
  ],
});
