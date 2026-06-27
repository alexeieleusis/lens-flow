import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-blind-as-cast.js";

const TEST_FILENAME = "file.ts";

ruleTester.run("no-blind-as-cast", rule, {
  valid: [
    {
      filename: TEST_FILENAME,
      code: `interface User { name: string }

function handleAuth(data: unknown): void {
  if (typeof data === "object" && data !== null && "name" in data) {
    const user = data as User;
  }
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `function isUser(o: unknown): o is { name: string } {
  return typeof o === "object" && o !== null && "name" in o && typeof (o as any).name === "string";
}
const json: unknown = JSON.parse(input);
if (isUser(json)) {
  json.name.toUpperCase();
}`,
    },
    {
      filename: TEST_FILENAME,
      code: `const val: string = "hello";
const result = val as string;`,
    },
    {
      filename: TEST_FILENAME,
      code: `function cast(data: unknown): unknown {
  return data as unknown;
}`,
    },
  ],
  invalid: [
    {
      filename: TEST_FILENAME,
      code: `const json: unknown = JSON.parse(input);
const user = json as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data: any = someValue;
const parsed = data as { id: number; label: string };`,
      errors: [{ messageId: "blindCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `interface MyType { value: number }
const data: any = someValue;
const result = data as MyType;`,
      errors: [{ messageId: "blindCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const result: unknown = fetchData();
const user = result as { name: string };`,
      errors: [{ messageId: "blindCast" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data = JSON.parse(input) as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const resp = (await fetch("/api/user")) as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data = (await JSON.parse(raw)) as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data: any = raw;
const parsed = (JSON.parse(data))! as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const resp = (globalThis.fetch?.("/api/user")) as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
    {
      filename: TEST_FILENAME,
      code: `const data: any = JSON.parse(raw);
const result = data as { name: string };`,
      errors: [{ messageId: "blindCastUntrusted" }],
    },
  ],
});
