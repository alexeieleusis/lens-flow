import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-never-reachable-endpoint.js";

ruleTester.run("no-never-reachable-endpoint", rule, {
  valid: [
    `function diverges(): never {
      throw new Error("unreachable");
    }`,
    `function loopForever(): never {
      while (true) {
        console.log("spinning");
      }
    }`,
    `const arrow = (): never => {
      for (;;) {
        // busy wait
      }
    };`,
    `function eitherThrow(x: boolean): never {
      if (x) {
        throw new Error("a");
      } else {
        throw new Error("b");
      }
    }`,
    `function switchNever(status: number): never {
      switch (status) {
        case 0: throw new Error("zero");
        case 1: throw new Error("one");
        default: throw new Error("other");
      }
    }`,
    `function switchMulti(status: number): never {
      switch (status) {
        case 0: console.log("zero"); throw new Error("zero");
        case 1: console.log("one"); throw new Error("one");
        default: throw new Error("other");
      }
    }`,
  ],
  invalid: [
    {
      code: `function bad(): never {
        console.log("hi");
      }`,
      errors: [{ messageId: "reachableEnd" }],
    },
    {
      code: `function emptyNever(): never {}`,
      errors: [{ messageId: "reachableEnd" }],
    },
    {
      code: `const arrow = (): never => {
        console.log("partial");
      };`,
      errors: [{ messageId: "reachableEnd" }],
    },
    {
      code: `function partialBranch(x: boolean): never {
        if (x) {
          throw new Error("x");
        }
      }`,
      errors: [{ messageId: "reachableEnd" }],
    },
    {
      code: `function returnsValue(): never {
        return 42;
      }`,
      errors: [{ messageId: "reachableEnd" }],
    },
    {
      code: `const exprArrow = (): never => someValue;`,
      errors: [{ messageId: "reachableEnd" }],
    },
  ],
});
