import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-object-freeze-without-readonly-annotation.js";

ruleTester.run("no-object-freeze-without-readonly-annotation", rule, {
  valid: [
    `const config = Object.freeze({ host: "localhost", port: 8080 }) as const;`,
    `const config: Readonly<{ host: string; port: number }> = Object.freeze({ host: "localhost", port: 8080 });`,
    `const x = Object.freeze({ a: 1 }) as Readonly<{ a: number }>;`,
    `Object.freeze({ host: "localhost", port: 8080 });`,
    `const result = someOtherFunction({ host: "localhost" });`,
    `const wrapper = { data: Object.freeze({ a: 1 }) };`,
    `const x: Readonly<{ a: number }> = wrap(Object.freeze({ a: 1 }));`,
    `const x = Object.freeze({ a: 1 }) as Utils.Readonly<{ a: number }>;`,
    `const y: Utils.Readonly<{ a: number }> = Object.freeze({ a: 1 });`,
  ],
  invalid: [
    {
      code: `const config = Object.freeze({ host: "localhost", port: 8080 });`,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `const settings = Object.freeze({ debug: true, verbose: false });`,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `const x = wrap(Object.freeze({ a: 1 }));`,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `
        const handler = (): Readonly<{ a: number }> => {
          const inner = Object.freeze({ a: 1 });
          return inner as Readonly<{ a: number }>;
        };
      `,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `const fn = () => Object.freeze({ a: 1 });`,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `let config = Object.freeze({ a: 1 });`,
      errors: [{ messageId: "missingReadonly" }],
    },
   {
      code: `var config = Object.freeze({ a: 1 });`,
      errors: [{ messageId: "missingReadonly" }],
    },
    {
      code: `const { config } = Object.freeze({ config: { a: 1 } });`,
      errors: [{ messageId: "missingReadonly" }],
    },
  ],
});
