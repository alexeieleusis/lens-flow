import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-await-try-catch-in-generator.js";

ruleTester.run("require-await-try-catch-in-generator", rule, {
  valid: [
    `async function* safe(): AsyncGenerator<string, void, unknown> {
  try {
    const conn = await connect();
    while (true) {
      const msg = await conn.read();
      if (!msg) break;
      yield msg;
    }
  } catch (err) {
    // handle
  } finally {
    await conn.close();
  }
}`,
    `async function* safeWithNested(): AsyncGenerator<string, void, unknown> {
  try {
    const conn = await connect();
    yield await conn.read();
  } catch (err) {
    // handle
  }
}`,
    `async function normal() {
  const x = await fetch();
}`,
    `function* normalGen() {
  yield 1;
}`,
  ],
  invalid: [
    {
      code: `async function* leaky(): AsyncGenerator<string, void, unknown> {
  const conn = await connect();
  while (true) {
    const msg = await conn.read();
    yield msg;
  }
}`,
      errors: [
        { messageId: "missingTryCatch" },
        { messageId: "missingTryCatch" },
      ],
    },
    {
      code: `async function* bad() {
  yield await fetch();
}`,
      errors: [{ messageId: "missingTryCatch" }],
    },
    {
      code: `async function* bad2() {
  const x = await Promise.resolve(1);
  yield x;
}`,
      errors: [{ messageId: "missingTryCatch" }],
    },
  ],
});
