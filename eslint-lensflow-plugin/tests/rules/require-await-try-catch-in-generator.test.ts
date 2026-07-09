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
    // Nested async arrow function inside generator - outer awaits in try/catch, inner in its own try/catch
    `async function* genWithNestedFn() {
  try {
    const conn = await connect();
    const handler = async () => {
      try {
        const data = await conn.read();
        return data;
      } catch (e) {
        return null;
      }
    };
    const result = await handler();
    if (result) yield result;
  } catch (err) {
    return;
  }
}`,
    // Nested async function expression inside async generator - inner await not flagged by outer scope
    `async function* genWithNestedExpr() {
  try {
    const inner = async () => {
      const x = await fetchData();
      return x;
    };
    const val = await inner();
    yield val;
  } catch (err) {
    return;
  }
}`,
    // Class method async generator with try/catch
    `class C {
  async* method() {
    try {
      const conn = await connect();
      yield await conn.read();
    } catch (err) {
      return;
    }
  }
}`,
    // Function expression async generator with try/catch
    `const gen = async function*() {
  try {
    const conn = await connect();
    yield await conn.read();
  } catch (err) {
    return;
  }
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
    // Nested async function inside generator: only outer await is flagged
    {
      code: `async function* outerUncaught(): AsyncGenerator<string, void, unknown> {
  const conn = await connect();
  const handler = async () => {
    try {
      const msg = await conn.read();
      return msg;
    } catch (e) {
      return null;
    }
  };
  yield await handler();
}`,
      errors: [
        { messageId: "missingTryCatch" },
        { messageId: "missingTryCatch" },
      ],
    },
    // Class method async generator without try/catch
    {
      code: `class C {
  async* method() {
    const conn = await connect();
    yield await conn.read();
  }
}`,
      errors: [
        { messageId: "missingTryCatch" },
        { messageId: "missingTryCatch" },
      ],
    },
    // Function expression async generator without try/catch
    {
      code: `const gen = async function*() {
  const x = await Promise.resolve(1);
  yield x;
}`,
      errors: [{ messageId: "missingTryCatch" }],
    },
  ],
});
