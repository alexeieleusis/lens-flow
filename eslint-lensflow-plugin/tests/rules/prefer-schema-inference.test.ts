import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-schema-inference.js";

ruleTester.run("prefer-schema-inference", rule, {
  valid: [
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
    `interface Empty {}

    const EmptySchema = z.object({});`,
  ],
  invalid: [
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
  ],
});
