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

    // Nested block: const in inner block, let not used after block — valid
    `let conn = Db.open();
{
  const advanced = conn.connect();
  advanced.query("SELECT 1");
}`,

    // Parameter shadowing: function parameter shadows outer let — should NOT be flagged
    `let conn = Db.open();
    const advanced = conn.connect();
    function handler(conn) { conn.query("SELECT 1"); }`,

    // Destructured const assignment — rule only checks Identifier declarator ids
    `let conn = Db.open();
    const { advanced } = conn.connect();
    advanced.query("SELECT 1");`,

    // Arrow function parameter shadowing
    `let conn = Db.open();
    const advanced = conn.connect();
    const handler = (conn) => { conn.query("SELECT 1"); };`,

    // Multiple declarators: let variable not used after — should NOT be flagged
    `let conn = Db.open();
const a = conn.connect(), b = conn.close();
a.use();`,

    // Multiple declarators: only second declarator uses the let variable, but let not used after
    `let conn = Db.open();
const x = 1, y = conn.connect();
y.use();`,
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
    // Nested block: const in inner block, let used after block closes
    {
      code: `let conn = Db.open();
{
  const advanced = conn.connect();
}
conn.query("SELECT 1");`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Nested block: const in inner block, let used in conditional after block
    {
      code: `let client = Api.create();
{
  const authenticated = client.authenticate();
  authenticated.ready();
}
if (client.isReady) {
  client.request("/data");
}`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Deeply nested block: const in innermost block, let used at top level
    {
      code: `let state = Machine.init();
{
  {
    const running = state.start();
    running.process();
  }
}
state.stop();`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Nested block: multiple const assignments in inner block, let used after
    {
      code: `let db = Database.connect();
{
  const transaction = db.beginTransaction();
  transaction.exec("UPDATE");
}
db.close();`,
      errors: [{ messageId: "staleStateRef" }],
    },
    // Multiple declarators: let used after — reports on the specific declarator, not unrelated ones
    {
      code: `let conn = Db.open();
const a = conn.connect(), b = 42;
conn.query("SELECT 1");`,
      errors: [{ messageId: "staleStateRef" }],
    },
  ],
});
