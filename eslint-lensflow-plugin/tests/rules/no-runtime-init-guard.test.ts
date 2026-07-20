import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-runtime-init-guard.js";

ruleTester.run("no-runtime-init-guard", rule, {
  valid: [
    `class Http {
      url = "https://example.com";
      send() {
        return fetch(this.url);
      }
    }`,
    `class Service {
      config: string | undefined;
      init() { this.config = "ok"; }
      run() {
        if (this.config === undefined) return;
        return this.config.length;
      }
    }`,
    `class Validator {
      data: string;
      check() {
        if (!this.data) {
          console.warn("missing data");
          return;
        }
        return this.data.trim();
      }
    }`,
  ],
  invalid: [
    {
      code: `class HttpBad {
        url: string | undefined;
        setUrl(url: string) { this.url = url; }
        send() {
          if (!this.url) throw new Error("url not set");
          return fetch(this.url);
        }
      }`,
      errors: [{ messageId: "runtimeInitGuard" }],
    },
    {
      code: `class HttpArrow {
        url: string | undefined;
        setUrl(url: string) { this.url = url; }
        send = () => {
          if (!this.url) throw new Error("url not set");
          return fetch(this.url);
        };
      }`,
      errors: [{ messageId: "runtimeInitGuard" }],
    },
    {
      code: `class Client {
        token: string | undefined;
        authenticate(t: string) { this.token = t; }
        request() {
          if (!this.token) throw new Error("not authenticated");
          return fetch("/api", { headers: { Authorization: this.token } });
        }
      }`,
      errors: [{ messageId: "runtimeInitGuard" }],
    },
    {
      code: `class Service {
        config: string | undefined;
        setConfig(c: string) { this.config = c; }
        run() {
          if (this.config) {} else { throw new Error("config not set"); }
          return this.config.length;
        }
      }`,
      errors: [{ messageId: "runtimeInitGuard" }],
    },
    {
      code: `class Service {
        config: string | undefined;
        setConfig(c: string) { this.config = c; }
        run() {
          if (this.config) {} else throw new Error("config not set");
          return this.config.length;
        }
      }`,
      errors: [{ messageId: "runtimeInitGuard" }],
    },
  ],
});
