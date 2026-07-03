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
    // TSFunctionType with constrained type param
    `type F = <T extends { value: unknown }>() => T extends { value: infer V } ? V : never;`,
    // TSConstructorType with constrained type param
    `type C = new <T extends { value: unknown }>() => T extends { value: infer V } ? V : never;`,
    // TSClassDeclaration with constrained type param
    `class C<T extends { value: unknown }> { extract: T extends { value: infer V } ? V : never; }`,
    // TSMethodSignature with constrained type param
    `interface I { method<T extends { value: unknown }>() : T extends { value: infer V } ? V : never; }`,
    // TSPropertySignature with constrained interface-level type param
    `interface I<T extends { value: unknown }> { prop: T extends { value: infer V } ? V : never; }`,
    // TSMappedType — mapped key has constraint, outer T is constrained
    `type M<T extends { value: unknown }> = { [K in keyof T]: T extends { value: infer V } ? V : never; };`,
    // Nested scope — inner K shadows outer K, inner K is constrained
    `type Outer<K> = <K extends { value: unknown }>() => K extends { value: infer V } ? V : never;`,
    // Nested scope — outer T constrained, inner T also constrained
    `type Outer<T extends string> = <T extends number>() => T extends infer U ? U : never;`,
    // trueType references a different name, not the infer variable
    `type Foo<T> = T extends infer U ? V : never;`,
    // trueType wraps the infer in a utility type
    `type Bar<T> = T extends infer U ? NonNullable<U> : never;`,
    // Qualified name — checkType.typeName is TSQualifiedName, not Identifier
    `type Baz<NS> = NS.T extends infer U ? U : never;`,
    // Union checkType — not a TSTypeReference at all
    `type Qux<T> = T | string extends infer U ? U : never;`,
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
    // Inside interface property signature
    {
      code: `interface Container<T> { extract: T extends infer U ? U : never; }`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Multiple type parameters where the inferred one is unconstrained
    {
      code: `type Extract<T, Default> = T extends infer U ? U : Default;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSFunctionType — generic arrow type with unconstrained param
    {
      code: `type F = <T>() => T extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSConstructorType — generic constructor type with unconstrained param
    {
      code: `type C = new <T>() => T extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSClassDeclaration — class with unconstrained type param
    {
      code: `class C<T> { extract: T extends infer U ? U : never; }`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSInterfaceDeclaration — interface with unconstrained type param
    {
      code: `interface I<T> { process(): T extends infer U ? U : never; }`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSMethodSignature — method with its own unconstrained type param
    {
      code: `interface I { method<T>(): T extends infer U ? U : never; }`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSPropertySignature — interface-level unconstrained type param used in property conditional
    {
      code: `interface I<T> { prop: T extends infer U ? U : never; }`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // TSMappedType — outer type alias param is unconstrained
    {
      code: `type M<T> = { [K in keyof T]: T extends infer U ? U : never; };`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Nested scope — inner K shadows outer K, inner K is unconstrained
    {
      code: `type Outer<K> = <K>() => K extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
    // Nested scope — outer T constrained but inner T is unconstrained
    {
      code: `type Outer<T extends string> = <T>() => T extends infer U ? U : never;`,
      errors: [{ messageId: "inferFromUnconstrained" }],
    },
  ],
});
