import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-monolithic-interface-t59.js";

ruleTester.run("no-monolithic-interface-t59", rule, {
  valid: [
    `interface Small {
      id: string;
      name: string;
      createdAt: Date;
    }`,
    `interface SixMembers {
      id: string;
      name: string;
      createdAt: Date;
      update(): void;
      delete(): void;
      clone(): void;
    }`,
  ],
  invalid: [
    {
      code: `interface Entity {
        id: string;
        name: string;
        createdAt: Date;
        update(): void;
        delete(): void;
        clone(): Entity;
        serialize(): string;
      }`,
      errors: [{ messageId: "tooManyMembers" }],
    },
    {
      code: `interface Entity {
        id: string;
        name: string;
        createdAt: Date;
        update(): void;
        delete(): void;
        clone(): Entity;
        serialize(): string;
        validate(): boolean;
      }`,
      errors: [{ messageId: "tooManyMembers" }],
    },
  ],
});
