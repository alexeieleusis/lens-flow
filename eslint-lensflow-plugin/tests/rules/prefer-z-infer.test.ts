import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-z-infer.js";

ruleTester.run("prefer-z-infer", rule, {
  valid: [
    `type Config = z.infer<typeof ConfigSchema>;
    
    const ConfigSchema = z.object({ port: z.number(), host: z.string() });`,
    `type Config = z.infer<typeof ConfigSchema>;`,
    `type Config = { port: number; host: string };`,
    `type Config = string | number;`,
    `type Config = { a: number } & { b: string };
    
    const OtherSchema = z.object({ a: z.number() });`,
  ],
  invalid: [
    {
      code: `const ConfigSchema = z.object({ port: z.number(), host: z.string() });
      type Config = { port: number; host: string; debug?: boolean };`,
      errors: [{ messageId: "preferInfer" }],
    },
    {
      code: `const UserSchema = z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      });
      
      type User = { id: string; name: string; email: string };`,
      errors: [{ messageId: "preferInfer" }],
    },
    {
      code: `const StateSchema = z.object({ loading: z.boolean() });
      
      type State = { loading: boolean } | { loaded: boolean };`,
      errors: [{ messageId: "preferInfer" }],
    },
    {
      code: `type Config = { port: number; host: string };
      const ConfigSchema = z.object({ port: z.number(), host: z.string() });`,
      errors: [{ messageId: "preferInfer" }],
    },
  ],
});
