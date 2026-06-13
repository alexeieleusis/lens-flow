import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-branded-over-repeated-guard.js";

ruleTester.run("prefer-branded-over-repeated-guard", rule, {
  valid: [
    // Guard only called in one function — no issue
    String.raw`function isEmail(value: string): boolean {
      return /^[^\s@]+@[^\s@]+[.][^\s@]+$/.test(value);
    }
    function notifyUser(email: string) {
      if (!isEmail(email)) throw new Error();
      send(email);
    }`,
    // Guard called twice but within the same enclosing function
    String.raw`function isEmail(value: string): boolean {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
    function processAll(raw: string, secondary: string) {
      if (!isEmail(raw)) throw new Error();
      if (!isEmail(secondary)) throw new Error();
      send(raw);
    }`,
    // Function returning non-boolean is not a guard
    `function isEmail(value: string): number {
      return 1;
    }
    function notifyUser(email: string) {
      if (!isEmail(email)) throw new Error();
    }
    function addRecipient(email: string) {
      if (!isEmail(email)) throw new Error();
    }`,
    // Name does not match is[A-Z] pattern (lowercase second letter after "is")
    `function isvalid(value: string): boolean {
      return true;
    }
    function notifyUser(email: string) {
      if (!isvalid(email)) throw new Error();
    }
    function addRecipient(email: string) {
      if (!isvalid(email)) throw new Error();
    }`,
    // Already using branded type — no guard calls at all
    `type Email = string & { __brand: "Email" };
    function notifyUser(email: Email) { send(email); }
    function addRecipient(email: Email) { recipients.push(email); }`,
  ],
  invalid: [
    // Two functions each call the same guard
    {
      code: String.raw`function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function notifyUser(email: string) {
  if (!isEmail(email)) throw new Error();
  send(email);
}
function addRecipient(email: string) {
  if (!isEmail(email)) throw new Error();
  recipients.push(email);
}`,
      errors: [{ messageId: "repeatedGuard" }, { messageId: "repeatedGuard" }],
    },
    // Three functions call the same guard
    {
      code: `function isPositive(value: number): boolean {
  return value > 0;
}
function setAge(age: number) {
  if (!isPositive(age)) throw new Error();
}
function setQuantity(qty: number) {
  if (!isPositive(qty)) throw new Error();
}
function setPrice(price: number) {
  if (!isPositive(price)) throw new Error();
}`,
      errors: [
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
      ],
    },
    // Arrow function as guard
    {
      code: `const isUrl = (value: string): boolean => {
  return value.startsWith("http");
};
function fetch(url: string) {
  if (!isUrl(url)) throw new Error();
}
function open(url: string) {
  if (!isUrl(url)) throw new Error();
}`,
      errors: [{ messageId: "repeatedGuard" }, { messageId: "repeatedGuard" }],
    },
  ],
});
