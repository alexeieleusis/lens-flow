import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-template-literal-type-explosion.js";

ruleTester.run("no-template-literal-type-explosion", rule, {
  valid: [
    `type CRUD = "create" | "read" | "update" | "delete";
type UserActions = \`\${CRUD}User\`;`,
    `type Status = "pending" | "complete";
type Kind = "a" | "b";
type Combined = \`\${Status}\${Kind}\`;`,
    `type Simple = "hello" | "world";
type Result = \`\${Simple}_done\`;`,
    // Near-miss: single union interpolation — counts.length === 1, so no violation
    `type A = "a1" | "a2" | "a3" | "a4";
type X = \`\${A}_id\`;`,
    // Near-miss: non-union type reference — `string` is not in typeAliasMap
    `type X = \`\${string}_id\`;`,
    // Near-miss: qualified type reference — resolved name "Action" not in typeAliasMap
    `type NS = { Action: "a" | "b" | "c" | "d" | "e" | "f" };
type X = \`\${NS.Action}_id\`;`,
    {
      code: `type A = "a1" | "a2" | "a3" | "a4";
type B = "b1" | "b2" | "b3" | "b4";
type X = \`\${A}\${B}\`;`,
      options: [{ maxProduct: 16 }],
    },
    {
      code: `type A = "a1" | "a2" | "a3" | "a4";
type B = "b1" | "b2" | "b3" | "b4" | "b5";
type X = \`\${A}\${B}\`;`,
    },
  ],
  invalid: [
    {
      code: `type Action = "create" | "read" | "update" | "delete";
type Entity = "User" | "Post" | "Comment" | "Tag" | "Role" | "Permission";
type Fn = \`\${Action}\${Entity}\`;`,
      errors: [{ messageId: "cartesianProduct" }],
    },
    {
      code: `type A = "a1" | "a2" | "a3" | "a4";
type B = "b1" | "b2" | "b3" | "b4";
type C = "c1" | "c2";
type X = \`\${A}\${B}\${C}\`;`,
      errors: [{ messageId: "cartesianProduct" }],
    },
    {
      code: `type A = "a1" | "a2" | "a3" | "a4";
type B = "b1" | "b2" | "b3" | "b4";
type X = \`\${A}\${B}\`;`,
      options: [{ maxProduct: 10 }],
      errors: [{ messageId: "cartesianProduct" }],
    },
    {
      code: `type A = "a1" | "a2" | "a3" | "a4";
type B = "b1" | "b2" | "b3" | "b4";
type X = \`\${A}\${B}\`;`,
      options: [{ maxProduct: 15 }],
      errors: [{ messageId: "cartesianProduct" }],
    },
  ],
});
