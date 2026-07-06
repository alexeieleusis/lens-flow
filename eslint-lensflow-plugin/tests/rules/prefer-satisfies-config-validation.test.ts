import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-satisfies-config-validation.js";

ruleTester.run("prefer-satisfies-config-validation", rule, {
  valid: [
    `interface Config {
  host: string;
  port: number;
  logLevel: "debug" | "info" | "warn" | "error";
}
const config = {
  host: "localhost",
  port: 8080,
  logLevel: "info",
} satisfies Config;`,
    `const config = {
  host: "localhost",
  port: 8080,
};`,
    `function processConfig(c: Config) {
  if (!c.port) throw "missing port";
}`,
    `function validateConfig(c: any) {
  if (!c.port) throw "missing port";
}`,
    `const validateConfig = (c: unknown) => {
  if (c && typeof c === "object" && "port" in c) {
    return true;
  }
  return false;
};`,
    `function validateConfig(c: any): void;
function validateConfig(c: any) {
  if (!c.port) throw "missing port";
}`,
  ],
  invalid: [
    {
      code: `const config = {
  host: "localhost",
  prt: 8080,
  logLevel: "fine",
};
function validateConfig(c: any) {
  if (!c.port) throw "missing port";
  if (!["debug","info","warn","error"].includes(c.logLevel)) throw "bad logLevel";
}
validateConfig(config);`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function validateOptions(opts: any) {
  if (!opts.host) throw "missing host";
  if (!opts.timeout) throw "missing timeout";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `const validate = (settings: any) => {
  if (!settings.port) throw "no port";
  if (!["debug", "info"].includes(settings.logLevel)) throw "bad level";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function validate(c: any = {}) {
  if (!c.port) throw "missing port";
  if (!c.host) throw "missing host";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function validate(c: any) {
  if (c.port) {
    // ok
  } else { throw "missing port"; }
  if (c.host) {
    // ok
  } else { throw "missing host"; }
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function validate(c: any) {
  for (const key of ["port", "host"]) {
    if (!c[key]) throw "missing " + key;
  }
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function validate(...rest: any) {
  if (!rest[0].port) throw "missing port";
  if (!rest[0].host) throw "missing host";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function handle({ a }: any) {
  if (!a.port) throw "missing port";
  if (!a.host) throw "missing host";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `function handle([first]: any) {
  if (!first.port) throw "missing port";
  if (!first.host) throw "missing host";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `const validate = ({ c }: any) => {
  if (!c.port) throw "no port";
  if (!["debug", "info"].includes(c.logLevel)) throw "bad level";
}`,
      errors: [{ messageId: "preferSatisfies" }],
    },
  ],
});
