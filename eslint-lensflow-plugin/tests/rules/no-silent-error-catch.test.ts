import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-silent-error-catch.js";

ruleTester.run("no-silent-error-catch", rule, {
  valid: [
    // Correct: no try/catch at all, uses Result type
    `async function fetchUser(id: string): Promise<Result<User, FetchError>> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) return { ok: false, error: { tag: "NetworkError", status: res.status } };
  const data = await res.json();
  return { ok: true, value: data };
}`,
    // Valid: error is included in the rethrown Error message
    `async function fetchUser(id: string) {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    return res.json();
  } catch (e) {
    console.error(e);
    throw new Error("Failed: " + e);
  }
}`,
    // Valid: error is used for something other than just console logging
    `async function doSomething() {
  try {
    await riskyOperation();
  } catch (e) {
    console.error(e);
    logger.trackError(e);
    throw new Error("Failed");
  }
}`,
    // Valid: no generic Error thrown
    `async function doSomething() {
  try {
    await riskyOperation();
  } catch (e) {
    console.error(e);
    throw e;
  }
}`,
    // Valid: catch body does not throw new Error
    `async function doSomething() {
  try {
    await riskyOperation();
  } catch (e) {
    console.error(e);
    return null;
  }
}`,
    // Valid: nested function shadows catch parameter — no false positive
    `async function f() {
  try {
    await riskyOp();
  } catch (e) {
    const fn = (e) => { console.log(e); };
    fn(e);
    throw new Error("Failed");
  }
}`,
    // Valid: catch with destructured parameter — rule early-returns on non-Identifier params
    `async function f() {
  try {
    await riskyOp();
  } catch ({ message }) {
    console.error(message);
    throw new Error("Failed");
  }
}`,
    // Valid: parameterless catch clause (ES2019+) — node.param is undefined
    `function f() {
  try {
    riskyOp();
  } catch {
    throw new Error("Failed");
  }
}`,
    // Valid sync: error is included in the rethrown Error message
    `function fetchUser(id: string) {
  try {
    const res = fetch(\`/api/users/\${id}\`);
    return res;
  } catch (e) {
    console.error(e);
    throw new Error("Failed: " + e);
  }
}`,
    // Valid sync: error is used for tracking, not just logging
    `function doSomething() {
  try {
    riskyOperation();
  } catch (e) {
    console.error(e);
    logger.trackError(e);
    throw new Error("Failed");
  }
}`,
  ],
  invalid: [
    {
      code: `async function fetchUser(id: string): Promise<User> {
  try {
    const res = await fetch(\`/api/users/\${id}\`);
    return res.json();
  } catch (e) {
    console.error(e);
    throw new Error("Failed");
  }
}`,
      errors: [{ messageId: "silentErrorCatch" }],
    },
    {
      code: `async function loadData() {
  try {
    return await fetch("/data");
  } catch (err) {
    console.log(err);
    throw new Error("Something went wrong");
  }
}`,
      errors: [{ messageId: "silentErrorCatch" }],
    },
    {
      code: `async function process() {
  try {
    await doWork();
  } catch (e) {
    console.warn(e);
    throw new Error();
  }
}`,
      errors: [{ messageId: "silentErrorCatch" }],
    },
    // Invalid sync: error logged but not forwarded — same issue as async
    {
      code: `function fetchUser(id: string) {
  try {
    const res = fetch(\`/api/users/\${id}\`);
    return res;
  } catch (e) {
    console.error(e);
    throw new Error("Failed");
  }
}`,
      errors: [{ messageId: "silentErrorCatch" }],
    },
  ],
});
