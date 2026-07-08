import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-partial-construction-pattern.js";

ruleTester.run("no-partial-construction-pattern", rule, {
  valid: [
    // Only one empty-default field — need at least 2
    `class Single {
      name: string = "";
      set(data: Partial<{ name: string }>) {
        this.name = data.name ?? "";
      }
    }`,
    // No Partial-accepting method
    `class Fine {
      id: string = "";
      email: string = "";
      fill(id: string, email: string) {
        this.id = id;
        this.email = email;
      }
    }`,
    // Proper factory pattern — no empty defaults
    `class User {
      readonly id: string;
      readonly email: string;
      private constructor(id: string, email: string) {
        this.id = id;
        this.email = email;
      }
      static create(id: string, email: string): User | null {
        if (!id || !email) return null;
        return new User(id, email);
      }
    }`,
    // Partial method but no empty-default fields
    `class Config {
      id: string = "default";
      email: string = "default@x.com";
      set(data: Partial<{ id: string; email: string }>) {
        this.id = data.id ?? this.id;
        this.email = data.email ?? this.email;
      }
    }`,
  ],
  invalid: [
    {
      code: `class User {
        id: string = "";
        email: string = "";
        set(data: Partial<{ id: string; email: string }>) {
          this.id = data.id ?? "";
          this.email = data.email ?? "";
        }
      }`,
      errors: [{ messageId: "partialConstructionPattern" }],
    },
    {
      code: `class Product {
        name: string = "";
        price: number = 0;
        tags: string[] = [];
        update(data: Partial<{ name: string; price: number; tags: string[] }>) {
          this.name = data.name ?? "";
          this.price = data.price ?? 0;
          this.tags = data.tags ?? [];
        }
      }`,
      errors: [{ messageId: "partialConstructionPattern" }],
    },
    {
      code: `class Settings {
        theme: string = null;
        lang: string = null;
        apply(data: Partial<{ theme: string; lang: string }>) {
          this.theme = data.theme ?? null;
          this.lang = data.lang ?? null;
        }
      }`,
      errors: [{ messageId: "partialConstructionPattern" }],
    },
    {
      code: `class Widget {
        label: string = "";
        description: string = "";
        update(data: { label: string; description: string } | undefined) {
          if (data) {
            this.label = data.label;
            this.description = data.description;
          }
        }
      }`,
      errors: [{ messageId: "partialConstructionPattern" }],
    },
  ],
});
