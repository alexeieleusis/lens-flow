import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-bypass-exhaustiveness.js";

ruleTester.run("no-as-any-bypass-exhaustiveness", rule, {
  valid: [
    `function handle(msg: Message) {
  switch (msg.kind) {
    case "click": console.log(msg.x); break;
    default: assertNever(msg);
  }
}`,
    `function process(state: State) {
  switch (state.type) {
    case "a": return 1;
    case "b": return 2;
    default: throw new Error("unhandled");
  }
}`,
  ],
  invalid: [
    {
      code: `function handle(msg: Message) {
  switch (msg.kind) {
    case "click": console.log(msg.x); break;
    default: (msg as any);
  }
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
    {
      code: `function process(state: State) {
  switch (state.type) {
    case "a": return 1;
    default: const x = state as any; return x.value;
  }
}`,
      errors: [{ messageId: "bypassExhaustiveness" }],
    },
  ],
});
