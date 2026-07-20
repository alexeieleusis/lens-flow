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
    // Extraction outside any pipe (standalone call)
    `E.getOrElse(eitherValue, () => defaultUser);`,
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
    // EXTRACT_METHODS: getOrElse
    {
      code: `pipe(
        value,
        getOrElse(() => defaultValue),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: getOrNull
    {
      code: `pipe(
        value,
        getOrNull,
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: extract
    {
      code: `pipe(
        eitherValue,
        extract,
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: toOption
    {
      code: `pipe(
        eitherValue,
        toOption,
        someHandler
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: toNullable
    {
      code: `pipe(
        optionValue,
        toNullable,
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: fromEither
    {
      code: `pipe(
        eitherValue,
        fromEither,
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: fromOption
    {
      code: `pipe(
        optionValue,
        fromOption(nullValue),
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // EXTRACT_METHODS: fromIO
    {
      code: `pipe(
        ioValue,
        fromIO,
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: O.getOrElse
    {
      code: `pipe(
        optionValue,
        O.getOrElse(() => defaultValue),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: O.fold
    {
      code: `pipe(
        optionValue,
        O.fold(
          () => handleNone(),
          val => val * 2
        ),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: O.fromOption
    {
      code: `pipe(
        optionValue,
        O.fromOption,
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: E.fromEither
    {
      code: `pipe(
        eitherValue,
        E.fromEither,
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: TE.fold
    {
      code: `pipe(
        taskEitherValue,
        TE.fold(
          err => handleError(err),
          val => val * 2
        ),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: TE.fromIO
    {
      code: `pipe(
        taskIoValue,
        TE.fromIO,
        nextStep
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
    // NS_EXTRACT_METHODS: W.getOrElse
    {
      code: `pipe(
        theseValue,
        W.getOrElse(() => defaultValue),
        String
      );`,
      errors: [{ messageId: "prematureExtraction" }],
    },
  ],
});
