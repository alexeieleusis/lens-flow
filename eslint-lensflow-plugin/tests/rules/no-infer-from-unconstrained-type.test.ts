import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-infer-from-unconstrained-type.js";

ruleTester.run("no-infer-from-unconstrained-type", rule, {
  valid: [
    // Constrained type parameter — inference targets a meaningful pattern
    `type Extract<T extends { value: unknown }> = T extends { value: infer V } ? V : never;`,
    // Type parameter has an explicit extends constraint
    `type Unwrap<T extends Promise<unknown>> = T extends Promise<infer R> ? R : never;`,
    // Not an infer pattern at all — regular conditional
    `type IsString<T> = T extends string ? true : false;`,
    // infer used but true branch is not bare identity
    `type Wrap<T> = T extends infer U ? Array<U> : never;`,
    // Multiple type params, constrained one used for infer
    `type Get<K extends { key: unknown }, V> = K extends { key: infer R } ? R : V;`,
  ],
  invalid: [
    // Basic antipattern from the spec
    {
      code: `type Extract<T> = T extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Same pattern with different names
    {
      code: `type Identity<X> = X extends infer Y ? Y : string;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Inside interface method signature
    {
      code: `type Foo<T> = T extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Multiple type parameters where the inferred one is unconstrained
    {
      code: `type Extract<T, Default> = T extends infer U ? U : Default;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
  ],
});
