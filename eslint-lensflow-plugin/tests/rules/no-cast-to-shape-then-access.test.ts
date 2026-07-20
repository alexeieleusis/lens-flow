import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-cast-to-shape-then-access.js";

ruleTester.run("no-cast-to-shape-then-access", rule, {
  valid: [
    `function getId<T extends { id: string }>(obj: { data: T }): string {
  return obj.data.id;
}`,
    `const x = obj.data as { id: string };`,
    `const x = (obj.data as string).length;`,
  ],
  invalid: [
    {
      code: `function getId(obj: { data: any }) {
  return (obj.data as { id: string }).id;
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
    {
      code: `function getName(obj: { data: any }) {
  return (obj.data as { name: string; age: number }).name;
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
    {
      code: `function getFoo(obj: { data: any }) {
  return (obj.data as { id: string } & { foo: number }).id;
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
    {
      code: `function getBar(obj: { data: any }) {
  return (obj.data as ({ id: string })).id;
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
    {
      code: `function getIdComputed(obj: { data: any }) {
  return (obj.data as { id: string })["id"];
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
    {
      code: `function getIdNonNull(obj: { data: any }) {
  return (obj.data as { id: string })!.id;
}`,
      errors: [{ messageId: "castToShapeThenAccess" }],
    },
  ],
});
