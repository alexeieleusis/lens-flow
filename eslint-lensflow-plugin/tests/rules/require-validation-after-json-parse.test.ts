import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-validation-after-json-parse.js";

ruleTester.run("require-validation-after-json-parse", rule, {
  valid: [
    // JSON.parse result wrapped in schema validator (direct argument)
    `const data = UserSchema.parse(JSON.parse(req.body));
    database.save(data);`,
    // JSON.parse result stored in variable, then validated before use
    `const raw = JSON.parse(req.body);
    const validated = Schema.safeParse(raw);
    database.save(validated);`,
    // JSON.parse result used with a validation method
    `const raw = JSON.parse(input);
    const result = validator.validate(raw);`,
    // JSON.parse result stored but only used in validation calls
    `const raw = JSON.parse(input);
    const validated = schema.validate(raw);`,
    // let variable reassigned before use — no longer holds parsed data
    `let data = JSON.parse(input);
    data = { safe: true };
    database.save(data);`,
    // var variable reassigned before use — no longer holds parsed data
    `var data = JSON.parse(input);
    data = fallbackValue;
    database.save(data);`,
    // let variable validated before use
    `let raw = JSON.parse(req.body);
    const validated = Schema.parse(raw);
    database.save(validated);`,
  ],
  invalid: [
    // JSON.parse result used directly in non-validation call
    {
      code: `const data = JSON.parse(req.body);
      database.save(data);`,
      errors: [{ messageId: "unvalidatedVariableUsage" }],
    },
    // JSON.parse result as direct argument to non-validation function
    {
      code: `database.save(JSON.parse(req.body));`,
      errors: [{ messageId: "directUnvalidated" }],
    },
    // Variable assigned from JSON.parse used in multiple non-validation calls
    {
      code: `const data = JSON.parse(req.body);
      process(data);
      log(data);`,
      errors: [
        { messageId: "unvalidatedVariableUsage" },
        { messageId: "unvalidatedVariableUsage" },
      ],
    },
    // JSON.parse result used directly without any validation
    {
      code: `const raw = JSON.parse(input);
      console.log(raw);`,
      errors: [{ messageId: "unvalidatedVariableUsage" }],
    },
    // let variable used without reassignment — should still report
    {
      code: `let data = JSON.parse(input);
      database.save(data);`,
      errors: [{ messageId: "unvalidatedVariableUsage" }],
    },
    // var variable used without reassignment — should still report
    {
      code: `var data = JSON.parse(input);
      process(data);`,
      errors: [{ messageId: "unvalidatedVariableUsage" }],
    },
  ],
});
