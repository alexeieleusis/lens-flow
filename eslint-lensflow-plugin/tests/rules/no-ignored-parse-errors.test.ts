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
    `const timestamp = Date.parse("2024-01-01");`,
    `const ms = Date.parse(someString);`,
    `const obj = JSON.parse(raw);`,
    `const map = new Map(entries);`,
    {
      code: `const result = MyParser.parse(raw);`,
      options: [{ allowedReceivers: ["MyParser"] }],
    },
    {
      code: `const a = CustomParse.parse(x);
const b = AnotherParser.parse(y);`,
      options: [{ allowedReceivers: ["CustomParse", "AnotherParser"] }],
    },
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
    {
      code: `const data = Schema.parse(req.body);`,
      options: [{ allowedReceivers: ["OtherParser"] }],
      errors: [{ messageId: "unhandledParse" }],
    },
    {
      code: `try {
  doSomething();
} catch (e) {
  const data = Schema.parse(e.message);
}`,
      errors: [{ messageId: "unhandledParse" }],
    },
    {
      code: `try {
  items.forEach(item => {
    const data = Schema.parse(item);
  });
} catch (e) {
  handleError(e);
}`,
      errors: [{ messageId: "unhandledParse" }],
    },
  ],
});
