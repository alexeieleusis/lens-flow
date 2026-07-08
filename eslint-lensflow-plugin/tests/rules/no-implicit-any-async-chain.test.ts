import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-implicit-any-async-chain.js";

ruleTester.run("no-implicit-any-async-chain", rule, {
  valid: [
    `interface Response { items: { name: string }[] }
const data: Response = await fetch(url).then(r => r.json());`,
    `const data: any = await fetch(url).json();`,
    `const data = await fetch(url).then(r => r.text());`,
    `const data = await fetch(url);`,
    `const data = fetch(url).then(r => { return r.json() });`,
    `const data = fetch(url).then(function(r) { return r.json() });`,
  ],
  invalid: [
    {
      code: `const data = await fetch(url).then(r => r.json());`,
      errors: [{ messageId: "implicitAnyAsyncChain" }],
    },
    {
      code: `const result = await fetch(url).json();`,
      errors: [{ messageId: "implicitAnyAsyncChain" }],
    },
    {
      code: `const config = fetch(url).then(r => r.json());`,
      errors: [{ messageId: "implicitAnyAsyncChain" }],
    },
  ],
});
