import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-object-freeze-without-readonly-annotation.js";

ruleTester.run("no-object-freeze-without-readonly-annotation", rule, {
  valid: [
    // Direct init: Object.freeze() retypes its return value as Readonly<T>
    `const config = Object.freeze({ host: "localhost", port: 8080 }) as const;`,
    `const config: Readonly<{ host: string; port: number }> = Object.freeze({ host: "localhost", port: 8080 });`,
    `const x = Object.freeze({ a: 1 }) as Readonly<{ a: number }>;`,
    `Object.freeze({ host: "localhost", port: 8080 });`,
    `const result = someOtherFunction({ host: "localhost" });`,
    `const wrapper = { data: Object.freeze({ a: 1 }) };`,
    `const x: Readonly<{ a: number }> = wrap(Object.freeze({ a: 1 }));`,
    `const x = Object.freeze({ a: 1 }) as Utils.Readonly<{ a: number }>;`,
    `const y: Utils.Readonly<{ a: number }> = Object.freeze({ a: 1 });`,
    // Direct init without annotation — freeze already provides Readonly<T> return type
    `const config = Object.freeze({ host: "localhost", port: 8080 });`,
    `const settings = Object.freeze({ debug: true, verbose: false });`,
    `const fn = () => Object.freeze({ a: 1 });`,
    `let config = Object.freeze({ a: 1 });`,
    `var config = Object.freeze({ a: 1 });`,
    `const { config } = Object.freeze({ config: { a: 1 } });`,
    // Direct init inside arrow function — freeze return is Readonly<T>
    `
        const handler = (): Readonly<{ a: number }> => {
          const inner = Object.freeze({ a: 1 });
          return inner as Readonly<{ a: number }>;
        };
      `,
  ],
  invalid: [
    // Indirect init: wrapper may discard the Readonly<T> from freeze's return
    {
      code: `const x = wrap(Object.freeze({ a: 1 }));`,
      errors: [{ messageId: "missingReadonly" }],
    },
  ],
});
