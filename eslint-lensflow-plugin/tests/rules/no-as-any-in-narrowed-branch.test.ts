import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-as-any-in-narrowed-branch.js";

ruleTester.run("no-as-any-in-narrowed-branch", rule, {
  valid: [
    // No narrowing context — standalone as any should not be flagged by this rule
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  return (m as any).val;
}`,
    // Proper use of narrowing without as any
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    return m.val.toFixed(2);
  }
}`,
    // Narrowed branch but casting a different variable
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }, other: unknown) {
  if (m.type === "a") {
    return (other as any).something;
  }
}`,
    // Default switch case is not a narrowed branch (handled by different rule)
    `function handle(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  switch (m.type) {
    default: return (m as any).val;
  }
}`,
    // Nested in alternate branch — narrowing doesn't apply
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    return m.val;
  } else {
    return (m as any).val;
  }
}`,
    // Scope shadowing: inner binding shadows the narrowed variable
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    const m: unknown = getOther();
    return (m as any).x;
  }
}`,
    // Valid — cast in nested callback is outside narrowing scope
    `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    setTimeout(() => {
      // m may have been reassigned between guard and callback invocation
      doSomething(m as any);
    });
  }
}`,
    // Valid — let variable reassigned after narrowing, so cast isn't redundant
    `function process(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    m = getOther();
    return (m as any).unknownProp;
  }
}`,
  ],
  invalid: [
    // if guard: casting the narrowed variable itself
    {
      code: `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    return (m as any).val.toFixed(2);
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // if guard: casting a property of the narrowed variable
    {
      code: `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  if (m.type === "a") {
    const x = m.val as any;
    return x.toString();
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // switch case: casting the narrowed variable
    {
      code: `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  switch (m.type) {
    case "a":
      return (m as any).val.toFixed(2);
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // switch case: casting a property of the narrowed variable
    {
      code: `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }) {
  switch (m.type) {
    case "b":
      const s = m.val as any;
      return s.toUpperCase();
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // instanceof type guard
    {
      code: `function process(val: string | Date) {
  if (val instanceof Date) {
    return (val as any).getFullYear();
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // typeof type guard
    {
      code: `function process(val: string | number) {
  if (typeof val === "string") {
    return (val as any).toUpperCase();
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
    // Nested guard: inner guard narrows a different variable — outer guard narrows m
    {
      code: `function getValue(m: { type: "a"; val: number } | { type: "b"; val: string }, other: { type: "x" } | { type: "y" }) {
  if (m.type === "a") {
    if (other.type === "x") {
      return (m as any).val.toFixed(2);
    }
  }
}`,
      errors: [{ messageId: "redundantAsAny" }],
    },
  ],
});
