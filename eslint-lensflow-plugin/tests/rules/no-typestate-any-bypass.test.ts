import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-typestate-any-bypass.js";

ruleTester.run("no-typestate-any-bypass", rule, {
  valid: [
    // Proper typestate chain — no `as any`
    `if (hasDefaultUrl()) {
  request().method("POST").withDefaultUrl().send();
}`,
    // Simple variable cast to `any` — not a method chain
    `const x = value as any;`,
    // Cast to a specific type, not `any`
    `const result = request().method("POST").send() as Response;`,
    // Non-call expression cast to `any`
    `const x = someObject as any;`,
    // Deeply nested non-call member expression
    `const x = obj.prop.sub as any;`,
  ],
  invalid: [
    // Direct method call cast to `any`
    {
      code: `request().method("POST").send() as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
    // Single method call cast to `any`
    {
      code: `builder.build() as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
    // Long method chain cast to `any`
    {
      code: `request().method("POST").header("Content-Type", "json").body(data).send() as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
    // Method chain assigned then cast to `any`
    {
      code: `const result = factory.create().configure().build() as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
    // Optional chaining (ChainExpression) cast to `any`
    {
      code: `request()?.method("POST")?.send() as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
    // Non-null assertion (TSNonNullExpression) cast to `any`
    {
      code: `request()! as any;`,
      errors: [{ messageId: "typestateBypass" }],
    },
  ],
});
