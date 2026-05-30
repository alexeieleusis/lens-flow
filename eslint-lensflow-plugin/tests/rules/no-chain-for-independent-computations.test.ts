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
  ],
});
