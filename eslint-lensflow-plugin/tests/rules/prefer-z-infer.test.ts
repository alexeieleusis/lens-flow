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
    `interface User {
      id: number;
      name: string;
    }`,
    `const UserSchema = z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    });

    type User = z.infer<typeof UserSchema>;`,
    // Not a Zod schema — conventionally named variable should not trigger
    `const UserSchema = "some string";
    interface User { name: string; }`,
    `const ConfigSchema = 42;
    type Config = { port: number; };`,
    // Scope traversal should stop at function boundaries — outer ConfigSchema
    // must not match a type Config declared inside a nested function.
    `const ConfigSchema = z.object({ port: z.number(), host: z.string() });

    function handler() {
      type Config = { port: number; host: string };
    }`,
    // Non-zod `.infer` types are NOT treated as z.infer exemptions.
    // foo.infer is a TSTypeReference, not a type literal, so it won't
    // trigger the rule, but it also doesn't get the z.infer bypass.
    `type Config = foo.infer<typeof ConfigSchema>;

    const ConfigSchema = z.object({ port: z.number(), host: z.string() });`,
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
    {
      code: `const ConfigSchema = z.object({ port: z.number() });
      type Config = ({ port: number });`,
      errors: [{ messageId: "preferInfer" }],
    },
    {
      code: `interface User {
        id: number;
        name: string;
      }

      const UserSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().email(),
      });`,
      errors: [{ messageId: "redundantInterface" }],
    },
    {
      code: `const ProductSchema = z.object({
        sku: z.string(),
        price: z.number(),
      });

      interface Product {
        sku: string;
        price: number;
      }`,
      errors: [{ messageId: "redundantInterface" }],
    },
    // Multiple type aliases in the same scope — only `Config` matches
    // `ConfigSchema`; `Other` has no corresponding `OtherSchema`, so only
    // one error should be reported (no duplicates, no misses).
    {
      code: `const ConfigSchema = z.object({ port: z.number(), host: z.string() });

      type Config = { port: number; host: string };
      type Other = { name: string; age: number };`,
      errors: [{ messageId: "preferInfer" }],
    },
  ],
});
