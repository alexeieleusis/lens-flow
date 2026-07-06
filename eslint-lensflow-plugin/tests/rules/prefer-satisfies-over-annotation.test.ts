import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-satisfies-over-annotation.js";

ruleTester.run("prefer-satisfies-over-annotation", rule, {
  valid: [
    `interface Config { mode: "production" | "development" }
const cfg = { mode: "production" } satisfies Config;`,
    `interface Config { mode: "production" | "development" }
let cfg: Config = { mode: "production" };`,
    `interface Config { mode: "production" | "development" }
const cfg: Config = { mode: someVariable };`,
    `const cfg = { mode: "production" };`,
    `interface Config { mode: string }
const cfg: Config = { mode: getValue() };`,
  ],
  invalid: [
    {
      code: `interface Config { mode: "production" | "development" }
const cfg: Config = { mode: "production" };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `interface Options { port: number; host: string }
const opts: Options = { port: 3000, host: "localhost" };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `type State = { status: "idle" | "loading" | "done"; count: number }
const s: State = { status: "idle", count: 0 };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `interface Config { mode: "production"; count: number }
const cfg: Config = { mode: "production", count: getValue() };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `interface Config { mode: "production" }
interface Options { mode: "development" }
const x: Config | Options = { mode: "production" };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
    {
      code: `namespace NS { export interface Config { mode: string } }
const cfg: NS.Config = { mode: "production" };`,
      errors: [{ messageId: "preferSatisfies" }],
    },
  ],
});
