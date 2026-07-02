import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unsafe-json-parse-brand-cast.js";

ruleTester.run("no-unsafe-json-parse-brand-cast", rule, {
  valid: [
    // Normal branded cast from a validated source — not from JSON.parse
    `type UserId = string & { readonly __brand: "UserId" };

function makeUserId(raw: string): UserId {
  if (!raw) throw new Error("Empty id");
  return raw as UserId;
}`,
    // JSON.parse output cast to a primitive — not a branded type
    `function loadRaw(json: string) {
  const data = JSON.parse(json);
  return data.id as string;
}`,
    // Direct cast of a literal to a branded type
    `type Age = number & { readonly __brand: "Age" };
const age = 25 as Age;`,
    // Property access on a non-JSON-parse source cast to branded type
    `type UserId = string & { readonly __brand: "UserId" };
function getUser(req: { userId: string }): UserId {
  return req.userId as UserId;
}`,
    // Identifier shadowing — shadowed parameter must NOT trace to outer JSON.parse
    `type UserId = string & { readonly __brand: "UserId" };
const data = JSON.parse(json);
function validate(data: { id: UserId }): UserId {
  return data.id as UserId;
}`,
    // Reassignment — let variable reassigned to validated value should NOT report
    `type UserId = string & { readonly __brand: "UserId" };
function loadUser(json: string, validatedData: { id: UserId }): UserId {
  let data = JSON.parse(json);
  data = validatedData;
  return data.id as UserId;
}`,
  ],
  invalid: [
    // Direct property access on JSON.parse result cast to branded type
    {
      code: `type UserId = string & { readonly __brand: "UserId" };

function loadUser(json: string): { id: UserId } {
  const data = JSON.parse(json);
  return { id: data.id as UserId };
}`,
      errors: [{ messageId: "unsafeBrandCast" }],
    },
    // Variable transitively from JSON.parse cast to branded type
    {
      code: `type Age = number & { readonly __brand: "Age" };

function loadAge(json: string): Age {
  const parsed = JSON.parse(json);
  const raw = parsed.age;
  return raw as Age;
}`,
      errors: [{ messageId: "unsafeBrandCast" }],
    },
    // Inline JSON.parse with member access cast to branded type
    {
      code: `type Score = number & { readonly __brand: "Score" };

function loadScore(json: string): Score {
  return JSON.parse(json).score as Score;
}`,
      errors: [{ messageId: "unsafeBrandCast" }],
    },
    // Generic branded type reference (non-intersection)
    {
      code: `type UserId = Branded<string, "UserId">;

function loadUser(json: string): { id: UserId } {
  const data = JSON.parse(json);
  return { id: data.id as UserId };
}`,
      errors: [{ messageId: "unsafeBrandCast" }],
    },
    // Destructured variable from JSON.parse cast to branded type
    {
      code: `type UserId = string & { readonly __brand: "UserId" };

function loadUser(json: string): UserId {
  const data = JSON.parse(json);
  const { id } = data;
  return id as UserId;
}`,
      errors: [{ messageId: "unsafeBrandCast" }],
    },
  ],
});
