import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-chain-for-independent-computations.js";

ruleTester.run("no-chain-for-independent-computations", rule, {
  valid: [
    // Parameter IS used — dependent computation, chain is correct
    `pipe(
      validateEmail(email),
      E.chain((emailResult) => validatePassword(emailResult.password)),
    );`,
    // Parameter used in flatMap
    `result.flatMap((x) => process(x.value));`,
    // Callback has no parameter at all — passed directly
    `pipe(
      initial,
      E.chain(someOtherFunc),
    );`,
    // Not a chain/flatMap call
    `pipe(
      validateEmail(email),
      map((x) => x + 1),
    );`,
    // Parameter used in a nested expression
    `E.chain((prev) => {
      const val = prev.value;
      return validate(val);
    });`,
    // Object literal key with same name is NOT a reference — param is still used elsewhere
    `E.chain((x) => ({ x, computed: x + 1 }));`,
    // Optional chaining: parameter IS used — dependent computation
    `result?.flatMap((x) => process(x.value));`,
    // Destructured param (ObjectPattern) — intentionally skipped by the rule
    `E.chain(({ name }) => fetchIndependent());`,
    // Destructured param (ArrayPattern) — intentionally skipped by the rule
    `E.chain(([a]) => fetchIndependent());`,
  ],
  invalid: [
    // Classic antipattern: independent validations chained (no params)
    {
      code: `pipe(
  validateEmail(email),
  E.chain(() => validatePassword(password)),
);`,
      errors: [{ messageId: "noParamInChain" }],
    },
    // Multiple independent chain calls
    {
      code: `pipe(
  validateEmail(email),
  E.chain(() => validatePassword(password)),
  E.chain(() => validatePhone(phone)),
);`,
      errors: [
        { messageId: "noParamInChain" },
        { messageId: "noParamInChain" },
      ],
    },
    // flatMap variant with unused param
    {
      code: `result.flatMap((_) => fetchIndependent());`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Named parameter unused
    {
      code: `E.chain((prevResult) => validatePhone(phone));`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Function expression variant
    {
      code: `pipe(
  initial,
  E.chain(function (x) { return independentValidation(); }),
);`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Object literal key with same name is NOT a reference
    {
      code: `E.chain((x) => ({ x: 1 }));`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Non-computed member name with same name is NOT a reference
    {
      code: `E.chain((x) => obj.x);`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Default parameter (AssignmentPattern) — unwrapped and detected
    {
      code: `E.chain((x = 1) => fetchIndependent());`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
    // Rest parameter — unwrapped and detected
    {
      code: `E.chain((...args) => fetchIndependent());`,
      errors: [{ messageId: "unusedParamInChain" }],
    },
  ],
});
