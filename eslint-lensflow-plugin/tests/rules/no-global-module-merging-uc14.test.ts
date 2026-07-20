import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-global-module-merging-uc14.js";

ruleTester.run("no-global-module-merging-uc14", rule, {
  valid: [
    `declare module "my-framework/types" {
  interface AppConfig {
    auth: Auth;
  }
}`,
    `interface MyConfig {
  value: string;
}`,
    `declare namespace MyApp {
  interface Settings {
    theme: string;
  }
}`,
    `declare module MyApp {
  interface Settings {
    theme: string;
  }
}`,
  ],
  invalid: [
    {
      code: `declare global {
  interface Window {
    auth: Auth;
  }
}`,
      errors: [{ messageId: "globalNamespacePollution" }],
    },
    {
      code: `declare module "my-framework/types" {
  interface ExtendedWindow extends Window {
    customAuth: boolean;
  }
}`,
      errors: [{ messageId: "builtInInterfaceAugmentation" }],
    },
    {
      code: `declare global {
  interface Document {
    customProp: string;
  }
}`,
      errors: [{ messageId: "globalNamespacePollution" }],
    },
    {
      code: `declare module "my-framework/types" {
  interface Foo extends NodeJS {
    customProp: string;
  }
}`,
      errors: [{ messageId: "builtInInterfaceAugmentation" }],
    },
    {
      code: `declare module "my-framework/types" {
  interface Bar extends NodeJS.Global {
    customProp: string;
  }
}`,
      errors: [{ messageId: "builtInInterfaceAugmentation" }],
    },
  ],
});
