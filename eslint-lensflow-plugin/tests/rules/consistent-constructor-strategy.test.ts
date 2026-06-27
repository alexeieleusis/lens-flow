import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/consistent-constructor-strategy.js";

ruleTester.run("consistent-constructor-strategy", rule, {
  valid: [
    // All throwing: consistent strategy
    `type Email = string & { _brand: "Email" };
     type Port = number & { _brand: "Port" };

     function parseEmail(s: string): Email {
       if (!s.includes("@")) throw new Error("invalid");
       return s as Email;
     }

     function parsePort(n: number): Port {
       if (n < 1 || n > 65535) throw new Error("out of range");
       return n as Port;
     }`,

    // All result-returning: consistent strategy
    `type Email = string & { _brand: "Email" };
     type Port = number & { _brand: "Port" };

     function tryParseEmail(s: string): Email | Error {
       if (!s.includes("@")) return new Error("invalid");
       return s as Email;
     }

     function tryParsePort(n: number): Port | Error {
       if (n < 1 || n > 65535) return new Error("out of range");
       return n as Port;
     }`,

    // Single constructor — no inconsistency possible
    `type Email = string & { _brand: "Email" };

     function parseEmail(s: string): Email {
       if (!s.includes("@")) throw new Error("invalid");
       return s as Email;
     }`,

    // No branded types involved — rule doesn't apply
    `function add(a: number, b: number): number {
       return a + b;
     }

     function sub(a: number, b: number): number {
       return a - b;
     }`,

    // Throw inside nested callback — not attributed to outer constructor
     `type Email = string & { _brand: "Email" };

      function parseEmail(s: string): Email {
        const inner = () => { throw new Error("inner"); };
        return s as Email;
      }`,

     // FunctionExpression with throwing strategy
      `type Email = string & { _brand: "Email" };

       const parseEmail = function(s: string): Email {
         if (!s.includes("@")) throw new Error("invalid");
         return s as Email;
       };`,

     // All throwing, exported — consistent strategy
     `type Email = string & { _brand: "Email" };
      type Port = number & { _brand: "Port" };

      export function parseEmail(s: string): Email {
        if (!s.includes("@")) throw new Error("invalid");
        return s as Email;
      }

      export function parsePort(n: number): Port {
        if (n < 1 || n > 65535) throw new Error("out of range");
        return n as Port;
      }`,

   // All result-returning, exported — consistent strategy
      `type Email = string & { _brand: "Email" };

       export function tryParseEmail(s: string): Email | Error {
         if (!s.includes("@")) return new Error("invalid");
         return s as Email;
       }`,

     // Valid — quoted brand property key
     `type Email = string & { "_brand": "Email" };
      function parseEmail(s: string): Email {
        if (!s.includes("@")) throw new Error("invalid");
        return s as Email;
      }`,
    ],
  invalid: [
    {
      code: `type Email = string & { _brand: "Email" };
type Port = number & { _brand: "Port" };

function parseEmail(s: string): Email {
  if (!s.includes("@")) throw new Error("invalid");
  return s as Email;
}

function tryParsePort(n: number): Port | Error {
  if (n < 1 || n > 65535) return new Error("out of range");
  return n as Port;
}`,
      errors: [
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
      ],
    },
    {
      code: `type UserId = string & { _brand: "UserId" };
type Token = string & { __brand: "Token" };
type Config = object & { configBrand: true };

function makeUserId(s: string): UserId {
  if (s.length < 3) throw new Error("too short");
  return s as UserId;
}

const createToken = (s: string): Token | Error => {
  if (s.length < 8) return new Error("too short");
  return s as Token;
};

function makeConfig(): Config {
  return {} as Config;
}

const parseConfig = (): Config | Error => {
  return new Error("not found");
};`,
      errors: [
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
      ],
    },
    {
      code: `type Amount = number & { _brand: "Amount" };
type Rate = number & { _brand: "Rate" };
type Count = number & { _brand: "Count" };

function parseAmount(n: number): Amount {
  if (n < 0) throw new Error("negative");
  return n as Amount;
}

function parseRate(n: number): Rate | Error {
  if (n <= 0 || n > 1) return new Error("invalid");
  return n as Rate;
}

function parseCount(n: number): Count | Error {
  if (n < 0) return new Error("negative");
  return n as Count;
}`,
      errors: [
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
      ],
    },
    {
      code: `type Email = string & { _brand: "Email" };
type Port = number & { _brand: "Port" };

export function parseEmail(s: string): Email {
  if (!s.includes("@")) throw new Error("invalid");
  return s as Email;
}

export function tryParsePort(n: number): Port | Error {
  if (n < 1 || n > 65535) return new Error("out of range");
  return n as Port;
}`,
      errors: [
        { messageId: "inconsistent" },
        { messageId: "inconsistent" },
      ],
    },
  ],
});
