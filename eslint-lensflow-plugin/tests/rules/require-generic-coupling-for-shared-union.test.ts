import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-generic-coupling-for-shared-union.js";

ruleTester.run("require-generic-coupling-for-shared-union", rule, {
  valid: [
    `function sum<T extends number | string>(a: T, b: T): T {
      return a > b ? a : b;
    }`,
    `function single(a: number | string): void {
      console.log(a);
    }`,
    `function different(a: number | string, b: boolean | string): void {
      console.log(a, b);
    }`,
    `const fn = <T>(a: T, b: T): T => a;`,
    `const fn = function<T>(a: T, b: T): T { return a; };`,
    `type G = <T>(a: T, b: T) => T;`,
  ],
  invalid: [
    {
      code: `function sum(a: number | string, b: number | string): number {
        return Number(a) + Number(b);
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `function concat(a: string | number, b: string | number): string {
        return String(a) + String(b);
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `const process = (a: number | string, b: number | string) => {
        return a + b;
      };`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `const fn = function(a: number | string, b: number | string): number {
        return Number(a) + Number(b);
      };`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `function triple(a: boolean | number, b: boolean | number, c: boolean | number): void {
        console.log(a, b, c);
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `type Handler = (a: number | string, b: number | string) => void;`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `type F = (a: number | string, b: number | string) => void;`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `function mixedOrder(a: number | string, b: string | number): void {
        console.log(a, b);
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `class C {
        constructor(readonly a: number | string, private b: number | string) {}
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
    {
      code: `class Service {
        constructor(public url: string | number, public port: string | number) {}
      }`,
      errors: [{ messageId: "sharedUnionWithoutGeneric" }],
    },
  ],
});
