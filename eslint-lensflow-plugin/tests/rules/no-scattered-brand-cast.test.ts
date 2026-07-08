import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-scattered-brand-cast.js";

ruleTester.run("no-scattered-brand-cast", rule, {
  valid: [
    // Cast inside a smart constructor that returns the branded type
    `type Age = Branded<number, "Age">;

function makeAge(n: number): Age {
  if (n < 0 || n > 150) throw new Error("Invalid age");
  return n as Age;
}`,
    // Cast inside arrow-function smart constructor returning branded type
    `type UserId = Branded<string, "UserId">;

const makeUserId = (id: string): UserId => {
  if (!id) throw new Error("Empty id");
  return id as UserId;
};`,
    // Normal union type — not a branded type pattern
    `type Status = "pending" | "done";
const s: Status = "pending" as Status;`,
    // Regular primitive cast — not branded
    `const x = 42 as number;`,
  ],
  invalid: [
    // Cast at module scope
    {
      code: `type Age = Branded<number, "Age">;

const age1 = 25 as Age;
const age2 = Math.floor(Math.random() * 100) as Age;`,
      errors: [
        { messageId: "scatteredBrandCast" },
        { messageId: "scatteredBrandCast" },
      ],
    },
    // Cast inside a function that does NOT return the branded type
    {
      code: `type Age = Branded<number, "Age">;

function logAge(n: number): void {
  const age = n as Age;
  console.log(age);
}`,
      errors: [{ messageId: "scatteredBrandCast" }],
    },
    // Cast inside function returning unrelated branded type
    {
      code: `type Age = Branded<number, "Age">;
type Score = Branded<number, "Score">;

function makeScore(n: number): Score {
  return n as Age;
}`,
      errors: [{ messageId: "scatteredBrandCast" }],
    },
    // Intersection-based branded type at module scope
    {
      code: `type Password = string & { readonly __brand: "Password" };

const p = "secret" as Password;`,
      errors: [{ messageId: "scatteredBrandCast" }],
    },
    // Qualified type reference (TSQualifiedName) — Types.Branded<number, "Age">
    {
      code: `type Age = Types.Branded<number, "Age">;

const a = 25 as Types.Branded<number, "Age">;`,
      errors: [{ messageId: "scatteredBrandCast" }],
    },
    // Cast as a function argument — not in VariableDeclarator init position
    {
      code: `type Age = Branded<number, "Age">;

function process(a: Age) { return a; }
process(25 as Age);`,
      errors: [{ messageId: "scatteredBrandCast" }],
    },
  ],
});
