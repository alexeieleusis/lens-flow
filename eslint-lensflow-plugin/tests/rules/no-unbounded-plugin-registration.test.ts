import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unbounded-plugin-registration.js";

ruleTester.run("no-unbounded-plugin-registration", rule, {
  valid: [
    `class Host {
      private plugins = new Map<string, Plugin>();
      register(p: Plugin) {
        if (this.plugins.has(p.name)) throw new Error("duplicate");
        this.plugins.set(p.name, p);
      }
    }`,
    `class Host {
      plugins: Plugin[] = [];
      register(p: Plugin) {
        if (this.plugins.includes(p)) return;
        this.plugins.push(p);
      }
    }`,
    `class Host {
      plugins: Plugin[] = [];
      register(p: Plugin) {
        if (this.plugins.indexOf(p) !== -1) return;
        this.plugins.push(p);
      }
    }`,
    `class Host {
      plugins: Plugin[] = [];
      add(p: Plugin) { this.plugins.push(p); }
    }`,
    `class Host {
      plugins: Plugin[] = [];
      register(p: Plugin) {
        try {
          if (this.plugins.includes(p)) throw new Error("duplicate");
        } catch { /* noop */ }
        this.plugins.push(p);
      }
    }`,
  ],
  invalid: [
    {
      code: `class Host {
        plugins: Plugin[] = [];
        register(p: Plugin) { this.plugins.push(p); }
      }`,
      errors: [{ messageId: "unboundedRegister" }],
    },
    {
      code: `class PluginManager {
        private list: Plugin[] = [];
        register(plugin: Plugin) {
          console.log("registering");
          this.list.push(plugin);
        }
      }`,
      errors: [{ messageId: "unboundedRegister" }],
    },
    {
      code: `class Host {
        plugins: Plugin[] = [];
        register(p: Plugin) {
          if (debugMode) console.log("debug");
          this.plugins.push(p);
        }
      }`,
      errors: [{ messageId: "unboundedRegister" }],
    },
  ],
});
