import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-reuse-generator.js";

ruleTester.run("no-reuse-generator", rule, {
  valid: [
    // Fresh generator instance per loop — no reuse
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
  yield 2;
}
for await (const x of oneTime()) console.log(x);
for await (const x of oneTime()) console.log(x);`,

    // Single for await...of loop — no reuse
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
const gen = oneTime();
for await (const x of gen) console.log(x);`,

    // for await...of with non-call expression variable
    `const items = [1, 2, 3];
const gen = items[Symbol.asyncIterator]();
for await (const x of gen) console.log(x);`,

    // Sync for...of (not await) should not trigger
    `function* syncGen() { yield 1; }
const gen = syncGen();
for (const x of gen) console.log(x);
for (const x of gen) console.log(x);`,

    // for await...of with inline call — no variable to track
    `for await (const x of oneTime()) console.log(x);
for await (const x of oneTime()) console.log(x);`,

    // Block scope shadowing — inner `gen` is a different binding
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
const gen = oneTime();
for await (const x of gen) console.log(x);
{
  const gen = oneTime();
  for await (const x of gen) console.log(x);
}`,

    // Nested function scope shadowing — inner `gen` is a different binding
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
const gen = oneTime();
for await (const x of gen) console.log(x);
function inner() {
  const gen = oneTime();
  for await (const x of gen) console.log(x);
}`,

    // Nested IIFE scope shadowing — inner `gen` is a different binding
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
async function* otherGen(): AsyncGenerator<number> {
  yield 2;
}
const gen = oneTime();
for await (const x of gen) console.log(x);
(async () => {
  const gen = otherGen();
  for await (const x of gen) console.log(x);
})();`,

    // let reassignment to fresh generator — not a reuse
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
let gen = oneTime();
for await (const x of gen) console.log(x);
gen = oneTime();
for await (const x of gen) console.log(x);`,

    // var reassignment to fresh generator within function scope — not a reuse
    `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
async function run() {
  var gen = oneTime();
  for await (const x of gen) console.log(x);
  gen = oneTime();
  for await (const x of gen) console.log(x);
}`,
  ],
  invalid: [
    // Basic reuse of generator instance
    {
      code: `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
  yield 2;
}
const gen = oneTime();
for await (const x of gen) console.log(x);
for await (const x of gen) console.log(x);`,
      errors: [{ messageId: "reuseGenerator" }],
    },
    // Three uses — second and third both report
    {
      code: `async function* items(): AsyncGenerator<string> {
  yield "a";
}
const gen = items();
for await (const x of gen) console.log(x);
for await (const x of gen) console.log(x);
for await (const x of gen) console.log(x);`,
      errors: [
        { messageId: "reuseGenerator" },
        { messageId: "reuseGenerator" },
      ],
    },
    // NewExpression form
    {
      code: `class Gen {
  async *[Symbol.asyncIterator]() { yield 1; }
}
const gen = new Gen();
for await (const x of gen) console.log(x);
for await (const x of gen) console.log(x);`,
      errors: [{ messageId: "reuseGenerator" }],
    },
    // var reuse within function scope
    {
      code: `async function* oneTime(): AsyncGenerator<number> {
  yield 1;
}
async function run() {
  var gen = oneTime();
  for await (const x of gen) console.log(x);
  for await (const x of gen) console.log(x);
}`,
      errors: [{ messageId: "reuseGenerator" }],
    },
  ],
});
