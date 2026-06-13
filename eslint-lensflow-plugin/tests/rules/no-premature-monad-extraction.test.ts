import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-premature-monad-extraction.js";

ruleTester.run("no-premature-monad-extraction", rule, {
  valid: [
    // Extract at the end of pipe
    `pipe(
      parseUserId(input),
      E.chain(getUser),
      E.map(u => u.name),
      E.fold(err => showErr(err), name => render(name))
    );`,
    // No extraction at all
    `pipe(
      parseUserId(input),
      E.chain(getUser),
      E.map(u => u.name)
    );`,
    // Extraction is the last argument
    `pipe(
      fetchUser(),
      E.getOrElse(() => defaultUser)
    );`,
  ],
  invalid: [
    {
      code: `pipe(
        parseUserId(input),
        E.getOrElse(() => -1),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    {
      code: `pipe(
        eitherValue,
        E.fold(
          err => handleError(err),
          val => val * 2
        ),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
  ],
});
