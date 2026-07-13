import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-callback-type.js";

ruleTester.run("no-any-callback-type", rule, {
  valid: [
    // Explicit callable type preserves checking
    `type Handler = (event: MouseEvent) => void;`,
    // Non-rest parameter with any array
    `type Handler = (args: any[]) => any;`,
    // ReadonlyArray<any> as non-rest parameter (not rest, so valid)
    `type Handler = (args: ReadonlyArray<any>) => any;`,
    // Rest parameter but typed, not any[]
    `type Handler = (...args: string[]) => void;`,
    // Rest any[] but typed return
    `type Handler = (...args: any[]) => string;`,
    // Two parameters
    `type Handler = (a: string, b: number) => any;`,
    // No parameters
    `type Handler = () => any;`,
    // Rest parameter with tuple
    `type Handler = (...args: [string, number]) => any;`,
    // ReadonlyArray<any> rest param but typed return
    `type Handler = (...args: ReadonlyArray<any>) => string;`,
    // Method signature with typed params
    `interface X { onEvent(event: MouseEvent): void; }`,
    // Method signature with rest but typed array
    `interface X { onEvent(...args: string[]): any; }`,
    // Method signature with rest any[] but typed return
    `interface X { onEvent(...args: any[]): string; }`,
    // Call signature with typed params
    `interface X { (event: MouseEvent): void; }`,
    // Call signature with rest but typed array
    `interface X { (...args: string[]): any; }`,
    // Call signature with rest any[] but typed return
    `interface X { (...args: any[]): string; }`,
  ],
  invalid: [
    {
      code: `type Handler = (...args: any[]) => any;`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    {
      code: `
        interface Callbacks {
          onEvent: (...args: any[]) => any;
        }
      `,
      errors: [{ messageId: "anyCallbackType" }],
    },
    {
      code: `type Fn = (...x: any[]) => any;`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // Interface method signature: `onEvent(...args: any[]): any;`
    {
      code: `interface X { onEvent(...args: any[]): any; }`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // Interface call signature: `(...args: any[]): any;`
    {
      code: `interface X { (...args: any[]): any; }`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // Type literal method signature
    {
      code: `type X = { onEvent(...args: any[]): any; };`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // Type literal call signature
    {
      code: `type X = { (...args: any[]): any; };`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    {
      code: `
        type Handler = {
          (event: string): void;
          onInit(...args: any[]): any;
        };
      `,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // ReadonlyArray<any> — callable type
    {
      code: `type Handler = (...args: ReadonlyArray<any>) => any;`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // ReadonlyArray<any> — interface method
    {
      code: `interface X { onEvent(...args: ReadonlyArray<any>): any; }`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // ReadonlyArray<any> — call signature
    {
      code: `interface X { (...args: ReadonlyArray<any>): any; }`,
      errors: [{ messageId: "anyCallbackType" }],
    },
    // ReadonlyArray<any> — type literal method
    {
      code: `type X = { onEvent(...args: ReadonlyArray<any>): any; };`,
      errors: [{ messageId: "anyCallbackType" }],
    },
  ],
});
