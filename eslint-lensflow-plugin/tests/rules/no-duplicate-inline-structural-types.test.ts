import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-duplicate-inline-structural-types.js";

ruleTester.run("no-duplicate-inline-structural-types", rule, {
  valid: [
    {
      code: `interface Config {
  host: string;
  port: number;
}

function createConfig(c: Config) { /* ... */ }
function applyConfig(c: Config) { /* ... */ }`,
    },
    {
      code: `function createConfig(c: { host: string; port: number }) { /* ... */ }
function applyConfig(c: { host: string; port: number }) { /* ... */ }`,
    },
    {
      code: `function a(c: { host: string; port: number }) {}
function b(c: { host: string; port: number }) {}
function c(c: { host: string; port: number; extra: boolean }) {}`,
    },
    {
      code: `const fn = (c: { x: number }) => c * 2;
const fn2 = (c: { x: string }) => c.length;`,
    },
    {
      code: `type UserId = string & { __brand: 'UserId' };
type ProductId = string & { __brand: 'ProductId' };
type OrderId = string & { __brand: 'OrderId' };

function a(c: { value: UserId }) {}
function b(c: { value: ProductId }) {}
function c(c: { value: OrderId }) {}`,
    },
    {
      code: `function a(c: { host: string }) {}
function b(c: { host?: string }) {}
function c(c: { host?: string }) {}`,
    },
    {
      code: `function a(c: { readonly host: string }) {}
function b(c: { host: string }) {}
function c(c: { host: string }) {}`,
    },
    {
      code: `function a(c: { host: string }) {}
 function b(c: { host?: string }) {}
 function c(c: { readonly host: string }) {}`,
    },
    {
      code: `class Service {
  create(c: { host: string; port: number }) {}
  apply(c: { host: string; port: number }) {}
}
`,
    },
    {
      code: `function createConfig(c: { host: string; port: number }) { /* ... */ }
 function applyConfig(c: { host: string; port: number }) { /* ... */ }
 function validateConfig(c: { host: string; port: number }) { /* ... */ }`,
      options: [{ minDuplicates: 4 }],
    },
    {
      code: `const defaultCfg = { host: "localhost", port: 3000 };
function createConfig(c: { host: string; port: number } = defaultCfg) {}
function applyConfig(c: { host: string; port: number } = defaultCfg) {}`,
    },
  ],
  invalid: [
    {
      code: `function createConfig(c: { host: string; port: number }) { /* ... */ }
function applyConfig(c: { host: string; port: number }) { /* ... */ }
function validateConfig(c: { host: string; port: number }) { /* ... */ }`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `const a = (c: { host: string; port: number }) => c;
const b = (c: { host: string; port: number }) => c;
const c = (c: { host: string; port: number }) => c;`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `function x(c: { host: string; port: number }) {}
function y(c: { host: string; port: number }) {}
function z(c: { host: string; port: number }) {}
function w(c: { host: string; port: number }) {}`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `function a(c: { host: string; port: number }) {}
  function b(c: { host: string; port: number }) {}
  function c(c: { host: string; port: number }) {}
  function d(c: { name: string; age: number }) {}
  function e(c: { name: string; age: number }) {}
  function f(c: { name: string; age: number }) {}`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `class Service {
  create(c: { host: string; port: number }) {}
  apply(c: { host: string; port: number }) {}
  validate(c: { host: string; port: number }) {}
}`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `function createConfig(c: { host: string; port: number }) { /* ... */ }
 function applyConfig(c: { host: string; port: number }) { /* ... */ }`,
      options: [{ minDuplicates: 2 }],
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `const defaultCfg = { host: "localhost", port: 3000 };
function createConfig(c: { host: string; port: number } = defaultCfg) {}
function applyConfig(c: { host: string; port: number } = defaultCfg) {}
function validateConfig(c: { host: string; port: number } = defaultCfg) {}`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `const a = (c: { host: string; port: number } = { host: "", port: 0 }) => c;
const b = (c: { host: string; port: number } = { host: "", port: 0 }) => c;
const c = (c: { host: string; port: number } = { host: "", port: 0 }) => c;`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
    {
      code: `class Service {
  create(c: { host: string; port: number } = defaultCfg) {}
  apply(c: { host: string; port: number } = defaultCfg) {}
  validate(c: { host: string; port: number } = defaultCfg) {}
}`,
      errors: [
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
        { messageId: "duplicateInlineType" },
      ],
    },
  ],
});
