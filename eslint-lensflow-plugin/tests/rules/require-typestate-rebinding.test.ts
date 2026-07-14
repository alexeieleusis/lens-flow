import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-typestate-rebinding.js";

ruleTester.run("require-typestate-rebinding", rule, {
  valid: [
    // Correct: rebind to the original let variable
    `let conn = Db.open();
conn = conn.connect();
conn.query("SELECT 1");`,

    // No let binding involved
    `const conn = Db.open();
const advanced = conn.connect();`,

    // let variable not used after the const assignment
    `let conn = Db.open();
const advanced = conn.connect();
advanced.query("SELECT 1");`,

    // const assignment but not a method call on let variable
    `let conn = Db.open();
const timeout = 5000;
conn.query("SELECT 1");`,

    // Method call result assigned to let variable (correct pattern)
    `let conn = Db.open();
let advanced = conn.connect();
advanced.query("SELECT 1");`,

    // Multiple let variables, no stale reference
    `let a = createA();
let b = a.transform();
b.use();`,

    // let variable used inside nested arrow function callback — should NOT be flagged
    `let conn = Db.open();
const advanced = conn.connect();
setTimeout(() => { conn.query("SELECT 1"); });`,

    // let variable used inside nested function expression — should NOT be flagged
    `let conn = Db.open();
const advanced = conn.connect();
const fn = function() { conn.query("SELECT 1"); };`,

    // let variable used inside nested FunctionDeclaration in block — should NOT be flagged
    `let conn = Db.open();
const advanced = conn.connect();
{
  function inner() { conn.query("SELECT 1"); }
}`,
  ],
  invalid: [
    // Basic antipattern: const assignment of method call on let, then let used
    {
      code: `let conn = Db.open();
const advanced = conn.connect();
conn.query("SELECT 1");`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Multiple method calls in chain
    {
      code: `let client = Api.create();
const authenticated = client.authenticate();
client.request("/data");`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Used in a different expression context
    {
      code: `let db = Database.connect();
const transaction = db.beginTransaction();
console.log(db);`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Used in a conditional
    {
      code: `let state = Machine.init();
const running = state.start();
if (state.isReady) {
  state.process();
}`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Optional chain call on let variable
    {
      code: `let conn = Db.open();
const advanced = conn?.connect();
conn.query("SELECT 1");`,
      errors: [{ messageId: "staleStateRef" }],
    },
  ],
});
