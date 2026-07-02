import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-swallowed-error-result.js";

ruleTester.run("no-swallowed-error-result", rule, {
  valid: [
    `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
  throw result.error;
}`,
    `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
  switch (result.error.kind) {
    case "EmptyInput": handleEmpty(); break;
    case "InvalidFormat": handleInvalid(result.error.input); break;
    default: assertNever(result.error);
  }
}`,
    `const result = parseInput(data);
if (result.isRight()) {
  use(result.value);
} else {
  handleError(result.error);
}`,
    `if (check.ok) {
  proceed();
} else {
  console.log("got error:", check.error);
}`,
    `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
  console.error(result.error);
}`,
    `const result = parseInput(data);
if (result.ok) {
  use(result.value);
}`,
    `if (x) {
  doThing();
} else {
  // not a Result check, should be fine even if empty
}`,
  ],
  invalid: [
    {
      code: `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
}`,
      errors: [{ messageId: "emptyElse" }],
    },
    {
      code: `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
  console.log("error");
}`,
      errors: [{ messageId: "trivialLog" }],
    },
    {
      code: `const result = parseInput(data);
if (result.isRight()) {
  use(result.value);
} else {
  console.error("something went wrong");
}`,
      errors: [{ messageId: "trivialLog" }],
    },
    {
      code: `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else {
  console.log("error");
  // still only one real statement that is trivial
}`,
      errors: [{ messageId: "trivialLog" }],
    },
    {
      code: `if (res.ok) {
  process(res.data);
} else {
  console.log("failed");
}`,
      errors: [{ messageId: "trivialLog" }],
    },
    {
      code: `const result = parseInput(data);
if (result.ok) {
  use(result.value);
} else console.log("error");`,
      errors: [{ messageId: "trivialLog" }],
    },
  ],
});
