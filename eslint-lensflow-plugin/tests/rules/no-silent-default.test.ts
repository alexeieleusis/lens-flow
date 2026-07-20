import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-silent-default.js";

ruleTester.run("no-silent-default", rule, {
  valid: [
    // default with assertNever — the correct pattern
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: assertNever(e);
  }
}`,
    // default with throw — acceptable exhaustiveness check
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: throw new Error("Unhandled: " + e.kind);
  }
}`,
    // default with return assertNever — acceptable
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event): void {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: return assertNever(e);
  }
}`,
    // non-discriminated-union switch (numeric discriminant) — heuristic skip
    `function handle(status: number) {
  switch (status) {
    case 200: console.log("ok"); break;
    default:
  }
}`,
    // switch without any string-literal cases — heuristic skip
    `const x = "hello";
function handle(e: { kind: string }) {
  switch (e.kind) {
    case x: console.log("dynamic"); break;
    default:
  }
}`,
    // default block with assertNever inside
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: { assertNever(e); }
  }
}`,
    // default with guard + throw in else branch — common exhaustiveness guard pattern
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: {
      if (!e) return;
      else throw new Error('Unhandled: ' + e.kind);
    }
  }
}`,
    // default with throw inside nested IfStatement — validation in nested control structure
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: {
      if (true) { throw new Error('exhaustive'); }
    }
  }
}`,
    // multiple consequent statements with assertNever — exercises nonEmpty.some(isSilentReturn)
    `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default:
      console.log("debug");
      assertNever(e);
  }
}`,
  ],
  invalid: [
    // empty default — the canonical antipattern
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default:
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with only a break
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: break;
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with only a continue — analogous to break, exits switch silently
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
for (const e of events) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: continue;
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with continue inside block — analogous to break inside block
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
for (const e of events) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: { continue; }
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with empty block
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: {}
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with return but no assertNever
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event): void {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: return;
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
    // default with comment (EmptyStatement) only
    {
      code: `type Event = { kind: "click"; x: number } | { kind: "scroll"; top: number };
function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: /* oh no, scroll is ignored! */
  }
}`,
      errors: [{ messageId: "silentDefault" }],
    },
  ],
});
