import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-direct-circular-alias.js";

ruleTester.run("no-direct-circular-alias", rule, {
  valid: [
    `type Good = { next: Good }[];`,
    `type AlsoGood = { tag: string; value: AlsoGood };`,
    `type Tree = { left: Tree; right: Tree };`,
    `type Nested = { data: { inner: Nested } };`,
    `type Simple = string | number;`,
    `type Dependent = { ref: Other }; type Other = { ref: Dependent };`,
    `type A = B[]; type B = A[];`,
    `type Foo = Namespace.Foo;`,
    `type Bar = A.B.C.Bar;`,
  ],
  invalid: [
    {
      code: `type Bad = Bad[];`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type AlsoBad = string | AlsoBad;`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type Circular = Circular & { x: number };`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type Self = Self[] | null;`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type P = (P);`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type Fn = () => Fn;`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type Ctr = new () => Ctr;`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type Keyof = keyof Keyof;`,
      errors: [{ messageId: "directCircularReference" }],
    },
    {
      code: `type X = X extends infer U ? U : never;`,
      errors: [{ messageId: "directCircularReference" }],
    },
  ],
});
