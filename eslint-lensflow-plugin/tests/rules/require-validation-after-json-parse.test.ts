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
  ],
});
