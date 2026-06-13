import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-unused-constraint-members.js";

ruleTester.run("no-unused-constraint-members", rule, {
  valid: [
    // Constraint members are actually accessed in the body
    `function getId<T extends { id: string; secret: string }>(x: T) {
      return x.id;
    }`,
    // All constraint members accessed
    `function logBoth<T extends { id: string; secret: string }>(x: T) {
      console.log(x.id, x.secret);
    }`,
    // No constraint on type parameter
    `function log<T>(x: T) {
      console.log("logged");
    }`,
    // Constraint is not a TSTypeLiteral
    `function process<T extends string>(x: T) {
      console.log(x);
    }`,
    // Arrow function that uses the constrained member
    `const handler = <T extends { value: number }>(item: T) => item.value * 2;`,
    // Function expression that uses all constrained members
    `const fn = function<T extends { a: string; b: number }>(x: T) {
      return { a: x.a, b: x.b };
    };`,
    // Multiple type parameters, all constraint members accessed
    `function pair<T extends { id: string }, U extends { val: number }>(a: T, b: U) {
      return [a.id, b.val];
    }`,
    // Only one member accessed — partial use means constraint is meaningful
    `function showId<T extends { id: string; secret: string }>(x: T) {
      alert(x.id);
    }`,
  ],
  invalid: [
    // Antipattern from spec — neither id nor secret accessed
    {
      code: `function log<T extends { id: string; secret: string }>(x: T) {
        console.log("logged");
      }`,
      errors: [{ messageId: "unusedConstraintMembers" }],
    },
    // Arrow function with unused constraint members
    {
      code: `const process = <T extends { name: string; age: number }>(item: T) => {
        console.log("processing");
      };`,
      errors: [{ messageId: "unusedConstraintMembers" }],
    },
    // Function expression with all constraint members unused
    {
      code: `const fn = function<T extends { foo: string; bar: boolean }>(x: T) {
        return 42;
      };`,
      errors: [{ messageId: "unusedConstraintMembers" }],
    },
  ],
});
