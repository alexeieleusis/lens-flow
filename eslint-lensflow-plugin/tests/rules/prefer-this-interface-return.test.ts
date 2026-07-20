import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-this-interface-return.js";

ruleTester.run("prefer-this-interface-return", rule, {
  valid: [
    `interface Entity {
      clone(): this;
    }`,
    `interface Entity {
      id: number;
      name: string;
    }`,
    `interface Entity {
      clone(): Other;
    }`,
    `interface Entity {
      merge(other: Entity): this;
    }`,
    `type Entity = {
      clone(): Entity;
    }`,
  ],
  invalid: [
    {
      code: `interface Entity {
        clone(): Entity;
      }`,
      errors: [{ messageId: "preferThis" }],
    },
    {
      code: `interface Entity {
        clone(): Entity;
        merge(other: Entity): Entity;
      }`,
      errors: [{ messageId: "preferThis" }, { messageId: "preferThis" }],
    },
    {
      code: `interface Widget {
        copy: () => Widget;
      }`,
      errors: [{ messageId: "preferThis" }],
    },
    {
      code: `interface Entity {
        Creator: new () => Entity;
      }`,
      errors: [{ messageId: "preferThis" }],
    },
  ],
});
