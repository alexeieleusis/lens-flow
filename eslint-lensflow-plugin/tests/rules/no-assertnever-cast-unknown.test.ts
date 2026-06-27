import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-assertnever-cast-unknown.js";

ruleTester.run("no-assertnever-cast-unknown", rule, {
  valid: [
    `function handleGood(msg: { type: "a" | "b" }) {
  switch (msg.type) {
    case "a": break;
    default: assertNever(msg);
  }
}`,
    `function handleOk(msg: { type: "a" | "b" }) {
  switch (msg.type) {
    case "a": break;
    default: assertExhaustive(msg);
  }
}`,
    `function notAssertNever(x: unknown) {
  doSomething(x as unknown);
}`,
  ],
  invalid: [
    {
      code: `function handleBad(msg: { type: "a" | "b" }) {
  switch (msg.type) {
    case "a": break;
    default: assertNever(msg as unknown);
  }
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
    {
      code: `function handleBad2(msg: { type: "a" | "b" }) {
  switch (msg.type) {
    case "a": break;
    default: assertExhaustive(msg as unknown);
  }
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
    {
      code: `function handleBad3(x: string) {
  assertNever(x as unknown);
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
    {
      code: `function handleBad4(x: string) {
  assertNever((x as unknown)!);
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
    {
      code: `function handleBad5(x: string) {
  assertNever((x as unknown) satisfies unknown);
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
  ],
});
