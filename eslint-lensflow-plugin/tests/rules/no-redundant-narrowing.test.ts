import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-redundant-narrowing.js";

ruleTester.run("no-redundant-narrowing", rule, {
  valid: [
    `function describe(x: string | number) {
  if (typeof x === "string") console.log(x.toUpperCase());
}`,
    `function process(x: string | number) {
  if (typeof x === "string") {
    console.log(x.toUpperCase());
  } else {
    console.log(x.toFixed(2));
  }
}`,
    `function check(x: string | number) {
  if (typeof x === "string") {
    if (typeof x === "number") {
      console.log(x);
    }
  }
}`,
    // Shadowed variable — inner `x` is a different binding, not redundant
    `function outer(x: string | number) {
  if (typeof x === "string") {
    function inner(x: string | number) {
      if (typeof x === "string") {
        console.log(x.toUpperCase());
      }
    }
  }
}`,
  ],
  invalid: [
    {
      code: `function describe(x: string | number) {
  if (typeof x === "string") {
    if (typeof x === "string") {
      console.log(x.toUpperCase());
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
    {
      code: `function handle(value: string | number | null) {
  if (value !== null) {
    if (value !== null) {
      console.log(value.toString());
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
    {
      code: `function handle(x: string | number) {
  if (x == "string") {
    if (x == "string") {
      console.log(x.toUpperCase());
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
    {
      code: `function handle(x: string | number | null) {
  if (x != null) {
    if (x != null) {
      console.log(x.toString());
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
    {
      code: `function process(x: string | number) {
  if (typeof x === "string") {
    for (let i = 0; i < 10; i++) {
      if (typeof x === "string") {
        console.log(x.toUpperCase());
      }
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
    {
      code: `function loop(x: string | number) {
  if (typeof x === "number") {
    while (x > 0) {
      if (typeof x === "number") {
        console.log(x.toFixed(2));
      }
      break;
    }
  }
}`,
      errors: [{ messageId: "redundantNarrowing" }],
    },
  ],
});
