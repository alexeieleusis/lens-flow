import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-plugin-context-uc14.js";

ruleTester.run("no-any-in-plugin-context-uc14", rule, {
  valid: [
    `interface PluginContext {
      log(msg: string): void;
      config: { apiUrl: string };
    }
    interface Plugin {
      run(ctx: PluginContext): Promise<void>;
    }`,
    `interface Handler {
      execute(input: string): number;
    }`,
    `interface Callback {
      onEvent: (data: string) => void;
    }`,
    `interface Service {
      process(item: { id: number }): { status: string };
    }`,
  ],
  invalid: [
    {
      code: `interface Plugin {
        run(ctx: any): any;
      }`,
      errors: [{ messageId: "anyParamAndReturn" }],
    },
    {
      code: `interface Extension {
        initialize(context: any): void;
      }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `interface Middleware {
        handle(request: Request): any;
      }`,
      errors: [{ messageId: "anyReturn" }],
    },
    {
      code: `interface Hook {
        callback: (data: any) => void;
      }`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `interface Factory {
        create: () => any;
      }`,
      errors: [{ messageId: "anyReturn" }],
    },
    {
      code: `interface Adapter {
        transform: (input: any) => any;
      }`,
      errors: [{ messageId: "anyParamAndReturn" }],
    },
    {
      code: `interface Multi {
        a(x: any): void;
        b(y: string): any;
      }`,
      errors: [{ messageId: "anyParam" }, { messageId: "anyReturn" }],
    },
  ],
});
