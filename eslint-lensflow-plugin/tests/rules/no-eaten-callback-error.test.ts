import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-eaten-callback-error.js";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

const URL = knowledgeUrl("catalog/T12-effect-tracking.md");

ruleTester.run("no-eaten-callback-error", rule, {
  valid: [
    `fetch("/api")
  .then(r => r.json())
  .then(r => callback(r))
  .catch(e => handleError(e));`,
    `fetch("/api")
  .then(r => r.json())
  .catch(function (err) {
    console.error(err);
  });`,
    `promise.catch(e => { throw e; });`,
    `promise.catch((e) => logger.log(e));`,
    `promise.catch(e => console.error(e));`,
    `promise.catch(e => console.warn(e));`,
    `promise.catch((err) => {
  reportError(err);
  throw err;
});`,
    `promise.catch()`,
  ],
  invalid: [
    {
      code: `fetch("/api")
  .then(r => r.json())
  .then(r => callback(r))
  .catch(e => {});`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      code: `promise.catch(e => { });`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      code: `promise.catch((err) => { ; ; });`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      code: `fetch("/api").catch(e => 42);`,
      errors: [{ messageId: "ignoredParam", data: { param: "e", url: URL } }],
    },
    {
      code: `promise.catch(err => null);`,
      errors: [{ messageId: "ignoredParam", data: { param: "err", url: URL } }],
    },
    {
      code: `promise.catch(e => "ignored");`,
      errors: [{ messageId: "ignoredParam", data: { param: "e", url: URL } }],
    },
    {
      code: `promise.catch(err => someOtherFunc());`,
      errors: [{ messageId: "ignoredParam", data: { param: "err", url: URL } }],
    },
    {
      code: `promise.catch(e => console.error("oops"));`,
      errors: [{ messageId: "ignoredParam", data: { param: "e", url: URL } }],
    },
    {
      code: `obj.method().catch(e => {});`,
      errors: [{ messageId: "emptyCatch" }],
    },
    {
      code: `asyncFn().catch(function(e) { return; });`,
      errors: [{ messageId: "ignoredParam" }],
    },
    {
      code: `promise.catch(({ message }) => { console.log("error"); });`,
      errors: [{ messageId: "ignoredParam" }],
    },
    {
      code: `promise.catch((e = "default") => { console.log("something"); });`,
      errors: [{ messageId: "ignoredParam", data: { param: "e", url: URL } }],
    },
    {
      code: `promise.catch((...args) => { console.log("error"); })`,
      errors: [{ messageId: "ignoredParam" }],
    },
  ],
});
