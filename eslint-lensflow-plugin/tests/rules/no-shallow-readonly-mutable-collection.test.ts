import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-shallow-readonly-mutable-collection.js";

ruleTester.run("no-shallow-readonly-mutable-collection", rule, {
  valid: [
    `class Config {
  readonly items: readonly string[];
  constructor() {
    this.items = [] as readonly string[];
  }
}`,
    `interface Config {
  readonly items: readonly string[];
}`,
    `type Config = {
  readonly items: readonly string[];
}`,
    `class Config {
  readonly map: ReadonlyMap<string, number>;
}`,
    `interface Config {
  readonly set: ReadonlySet<number>;
}`,
    `class Config {
  items: string[];
}`,
    `interface Config {
  items: string[];
}`,
    `class Config {
  readonly count: number;
}`,
    `type Config = {
  readonly value: string;
}`,
    `class Config {
  constructor(readonly items: readonly string[]) {}
}`,
    `class Config {
  constructor(readonly map: ReadonlyMap<string, number>) {}
}`,
    `class Config {
  constructor(readonly count: number) {}
}`,
  ],
  invalid: [
    {
      code: `class Config {
  readonly items: string[];
  constructor() {
    this.items = [];
  }
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `interface Config {
  readonly items: string[];
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `interface Config {
  readonly items: Array<string>;
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `type Config = {
  readonly items: string[];
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `class Config {
  readonly map: Map<string, number>;
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `interface Config {
  readonly set: Set<number>;
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `type Config = {
  readonly map: Map<string, number>;
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `class Config {
  readonly data: string[] & { custom?: boolean };
}`,
      errors: [{ messageId: "mutableIntersection" }],
    },
    {
      code: `interface Config {
  readonly cache: Map<string, unknown>;
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `class Config {
  constructor(readonly items: string[]) {}
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `class Config {
  constructor(readonly map: Map<string, number>) {}
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `class Config {
  constructor(readonly set: Set<number>) {}
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `interface Config {
  readonly "items": string[];
}`,
      errors: [{ messageId: "mutableArray" }],
    },
    {
      code: `type Config = {
  readonly "data": Map<string, number>;
}`,
      errors: [{ messageId: "mutableMapSet" }],
    },
    {
      code: `class Config {
  readonly "items": string[];
  constructor() {
    this["items"] = [];
  }
}`,
      errors: [{ messageId: "mutableArray" }],
    },
  ],
});
