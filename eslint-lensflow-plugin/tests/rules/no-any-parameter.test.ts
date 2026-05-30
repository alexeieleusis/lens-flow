import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-parameter.js";

ruleTester.run("no-any-parameter", rule, {
  valid: [
    `function createUser(name: string, email: string) {
      return { name, email };
    }`,
    `const fn = (x: number): number => x * 2;`,
    `type Handler = (req: Request, res: Response) => void;`,
    `function process(data: unknown) {
      return data;
    }`,
    `const arrow = (items: string[]) => items.join(",");`,
  ],
  invalid: [
    {
      code: `function createUser(name: any, email: any) {
        return { name, email };
      }`,
      errors: [
        { messageId: "anyParam" },
        { messageId: "anyParam" },
      ],
    },
    {
      code: `const bad = (value: any) => value.toString();`,
      errors: [{ messageId: "anyParam" }],
    },
    {
      code: `type BadHandler = (data: any) => void;`,
      errors: [{ messageId: "anyParam" }],
    },
  ],
});
