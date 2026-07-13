import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-runtime-generic-assumption.js";

ruleTester.run("no-runtime-generic-assumption", rule, {
  valid: [
    `function createObject(data: object): object { return data; }`,
    `function handle(data: string) {
      if (data.constructor === String) return true;
    }`,
    `const obj = { value: 1 };
    obj.constructor`,
    `function process<T extends { id: number }>(item: T) {
      return item.id;
    }`,
    // Nested function shadows a generic param name — inner param is not generic
    `function outer<T>(item: T) {
      const inner = (item: string) => item.constructor;
    }`,
  ],
  invalid: [
    {
      code: `function create<T>(data: T): T { return data; }
create({}).constructor`,
      errors: [{ messageId: "runtimeMetadataOnCall" }],
    },
    {
      code: `function clone<T>(value: T): T {
  return value.constructor(value);
}`,
      errors: [{ messageId: "runtimeMetadataAccess" }],
    },
    {
      code: `function inspect<T>(item: T): string {
  return item.__typename;
}`,
      errors: [{ messageId: "runtimeMetadataAccess" }],
    },
    {
      code: `function asString<T>(val: T): string {
  return val as string;
}`,
      errors: [{ messageId: "unsafeCastOnGeneric" }],
    },
    {
      code: `function wrap<T>(data: T) {
  const obj = data as object;
  return obj;
}`,
      errors: [{ messageId: "unsafeCastOnGeneric" }],
    },
    {
      code: `function getType<T>(item: T) {
  return item.prototype;
}`,
      errors: [{ messageId: "runtimeMetadataAccess" }],
    },
    {
      code: `const fn = <T>(x: T) => x.constructor;`,
      errors: [{ messageId: "runtimeMetadataAccess" }],
    },
    {
      code: `const fn = function<T>(x: T) { return x.__typename; };`,
      errors: [{ messageId: "runtimeMetadataAccess" }],
    },
  ],
});
