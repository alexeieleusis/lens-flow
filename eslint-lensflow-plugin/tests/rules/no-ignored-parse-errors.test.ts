import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-ignored-parse-errors.js";

ruleTester.run("no-ignored-parse-errors", rule, {
  valid: [
    `const result = Schema.safeParse(req.body);
if (!result.success) return respond(400, result.error);`,
    `try {
  const data = Schema.parse(req.body);
  processData(data);
} catch (e) {
  handleError(e);
}`,
    `Schema.safeParse(input);`,
    `function handler() {
  try {
    const parsed = zodSchema.parse(rawInput);
    return parsed;
  } catch (err) {
    return null;
  }
}`,
  ],
  invalid: [
    {
      code: `const data = Schema.parse(req.body);`,
      errors: [{ messageId: "unhandledParse" }],
    },
    {
      code: `function handle() {
  const result = MySchema.parse(request.payload);
  return result;
}`,
      errors: [{ messageId: "unhandledParse" }],
    },
    {
      code: `export const handler = (req: Request) => {
  const body = JsonSchema.parse(req.body);
  console.log(body);
};`,
      errors: [{ messageId: "unhandledParse" }],
    },
  ],
});
