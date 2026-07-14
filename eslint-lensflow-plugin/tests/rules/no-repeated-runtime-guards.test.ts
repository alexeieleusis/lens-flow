import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-repeated-runtime-guards.js";

ruleTester.run("no-repeated-runtime-guards", rule, {
  valid: [
    `type Port = number & { __brand: "Port" };
function connect(host: string, port: Port) {
  // always valid
}
function bind(host: string, port: Port) {
  // always valid
}`,
    `function connect(host: string, port: number) {
  if (port < 1 || port > 65535) throw new Error();
}
function bind(host: string, port: number) {
  // no duplicate guard
}`,
    `function connect(host: string, port: number) {
  if (port < 1 || port > 65535) throw new Error();
}
function listen(address: string, port: number) {
  // different first param type annotation
}`,
    `function connect(host: string, port: number) {
  if (port < 1 || port > 65535) throw new Error();
}
function connect(host: string, port: number) {
  if (port === 80) return;
}`,
    `const fn = (x: number) => {
  if (x < 0) throw new Error();
};`,
    `function connect(host: string, port: number) {
  if (!isValidPort(port)) throw new Error();
}
function bind(host: string, port: number) {
  if (!validatePort(port)) throw new Error();
}`,
    `function connect(host: string, port: number) {
  if (port < 1) throw new Error();
  const validate = (port: number) => {
    if (port > 100) throw new Error();
  };
}
function bind(host: string, port: number) {
  if (port > 100) throw new Error();
}`,
  ],
  invalid: [
    {
      code: `function connect(host: string, port: number) {
  if (port < 1 || port > 65535) throw new Error();
}
function bind(host: string, port: number) {
  if (port < 1 || port > 65535) throw new Error();
}`,
      errors: [
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
      ],
    },
    {
      code: `function connect(host: string, port: number) {
  if (port < 1) throw new Error();
  if (port > 65535) throw new Error();
}
function bind(host: string, port: number) {
  if (port < 1) throw new Error();
  if (port > 65535) throw new Error();
}`,
      errors: [
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
      ],
    },
    {
      code: `function connect(host: string, port: number) {
  if (!checkPort(port)) throw new Error();
}
function bind(host: string, port: number) {
  if (!checkPort(port)) throw new Error();
}`,
      errors: [
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
      ],
    },
    {
      code: `const connect = (host: string, port: number) => {
  if (port < 1 || port > 65535) throw new Error();
};
const bind = (host: string, port: number) => {
  if (port < 1 || port > 65535) throw new Error();
};`,
      errors: [
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
        { messageId: "repeatedGuard" },
      ],
    },
  ],
});
