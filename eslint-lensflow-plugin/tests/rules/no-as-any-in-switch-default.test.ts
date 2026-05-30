import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-in-switch-default.js";

ruleTester.run("no-as-any-in-switch-default", rule, {
  valid: [
    `function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: assertNever(e);
  }
}`,
    `function process(s: State) {
  switch (s.type) {
    case "a": return 1;
    case "b": return 2;
    default: throw new Error("unhandled");
  }
}`,
  ],
  invalid: [
    {
      code: `function handle(e: Event) {
  switch (e.kind) {
    case "click": console.log(e.x); break;
    default: (e as any).foo();
  }
}`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      code: `function process(s: State) {
  switch (s.type) {
    case "a": return 1;
    default: const x = s as any; return x.value;
  }
}`,
      errors: [{ messageId: "noAsAny" }],
    },
  ],
});
