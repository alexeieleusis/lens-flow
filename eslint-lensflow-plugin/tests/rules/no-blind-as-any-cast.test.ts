import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-blind-as-any-cast.js";

ruleTester.run("no-blind-as-any-cast", rule, {
  valid: [
    `function transition(obj: Obj<A>): Obj<B> {
  if (!obj.isValidForB()) throw new Error("Cannot transition to B");
  return obj as unknown as Obj<B>;
}`,
    `function transition(obj: Obj<A>): Obj<B> {
  if (!obj.isValidForB()) throw new Error("Cannot transition to B");
  return obj as any;
}`,
    `const fn = (obj: Obj<A>): Obj<B> => {
  if (obj.kind !== "A") throw new Error("Bad state");
  return obj as any;
}`,
    `function safe(obj: Obj<A>): Obj<B> {
  throw new Error("Not implemented");
  return obj as any;
}`,
    `function ok(): Obj<B> {
  return {} as Obj<B>;
}`,
    `function ok(): Obj<B> {
  return getObj() as unknown as Obj<B>;
}`,
  ],
  invalid: [
    {
      code: `function transition(obj: Obj<A>): Obj<B> {
  return obj as any;
}`,
      errors: [{ messageId: "blindAsAnyCast" }],
    },
    {
      code: `const fn = (obj: Obj<A>): Obj<B> => {
  return obj as any;
}`,
      errors: [{ messageId: "blindAsAnyCast" }],
    },
    {
      code: `function transition(obj: Obj<A>): Obj<B> {
  const x = 1;
  return obj as any;
}`,
      errors: [{ messageId: "blindAsAnyCast" }],
    },
    {
      code: `var fn = function(obj: Obj<A>): Obj<B> {
  return obj as any;
}`,
      errors: [{ messageId: "blindAsAnyCast" }],
    },
  ],
});
