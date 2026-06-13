import path from "node:path";   
import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import * as tsParser from "@typescript-eslint/parser";
import rule from "../../src/rules/require-undefined-handling-after-optional-chain.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const TEST_FILENAME = "tests/rules/test.ts";
const TS_CONFIG_DIR = path.resolve(__dirname, "../..");
const TS_CONFIG = path.join(TS_CONFIG_DIR, "tsconfig.test.json");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      project: TS_CONFIG,
      tsconfigRootDir: TS_CONFIG_DIR,
    },
  },
});

ruleTester.run("require-undefined-handling-after-optional-chain", rule, {
  valid: [
    // Handled with ?? before dereferencing
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city ?? "Unknown";
document.title = city.toUpperCase();
`,
    },
    // Handled with if guard
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
if (city !== undefined) {
  document.title = city.toUpperCase();
}
`,
    },
    // Handled with null check
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
if (city != null) {
  console.log(city.length);
}
`,
    },
    // Optional chain directly on use (no intermediate variable)
    {
      filename: TEST_FILENAME,
      code: `
interface Order { shippingAddress?: { city: string } }
declare const order: Order;
const upper = order?.shippingAddress?.city?.toUpperCase();
`,
    },
    // Not an optional chain (no optional access)
    {
      filename: TEST_FILENAME,
      code: `
interface Order { shippingAddress: { city: string } }
declare const order: Order;
const city = order.shippingAddress.city;
document.title = city.toUpperCase();
`,
    },
    // Variable not dereferenced after assignment
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
console.log(city);
`,
    },
    // Handled with ?? inline in the MemberExpression
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
const upper = city?.toUpperCase() ?? "UNKNOWN";
`,
    },
    // Handled with && guard inline
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
if (city != null && city.length > 0) {
  document.title = city.toUpperCase();
}
`,
    },
  ],
  invalid: [
    // Basic antipattern: dereference without handling
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const city = order?.shippingAddress?.city;
document.title = city.toUpperCase();
`,
      errors: [{ messageId: "unguardedAccess" }],
    },
    // Method call on optional chain result
    {
      filename: TEST_FILENAME,
      code: `
interface Data { items?: string[] }
declare const response: Data;
const items = response?.items;
items.forEach((x) => console.log(x));
`,
      errors: [{ messageId: "unguardedAccess" }],
    },
    // Property access on optional chain result
    {
      filename: TEST_FILENAME,
      code: `
interface Config { db?: { host: string; port: number } }
declare const config: Config;
const db = config?.db;
const port = db.port;
`,
      errors: [{ messageId: "unguardedAccess" }],
    },
    // Multiple unguarded accesses
    {
      filename: TEST_FILENAME,
      code: `
interface Address { city: string; zip: string }
interface Order { shippingAddress?: Address }
declare const order: Order;
const addr = order?.shippingAddress;
const c = addr.city;
const z = addr.zip;
`,
      errors: [
        { messageId: "unguardedAccess" },
        { messageId: "unguardedAccess" },
      ],
    },
  ],
});
