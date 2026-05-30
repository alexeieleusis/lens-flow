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
  ],
});
