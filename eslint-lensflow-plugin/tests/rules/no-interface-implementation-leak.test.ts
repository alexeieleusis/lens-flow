import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-interface-implementation-leak.js";

ruleTester.run("no-interface-implementation-leak", rule, {
  valid: [
    `export interface Cache {
      get(key: string): any | undefined;
      set(key: string, value: any): void;
    }`,
    `interface UserService {
      findUser(id: string): User | null;
      createUser(data: UserData): User;
    }`,
    `interface Config {
      enabled: boolean;
      timeout: number;
    }`,
    `interface DataStore {
      items: ReadonlyArray<string>;
      getCount(): number;
    }`,
  ],
  invalid: [
    {
      code: `export interface Cache {
        internalMap: Map<string, any>;
        get(key: string): any;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `interface InternalStore {
        _cache: Set<string>;
        _items: Array<number>;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `interface Repo {
        internalData: Map<string, unknown>;
        fetch(id: string): unknown;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `interface LeakyApi {
        _buffer: string[];
        process(): void;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `interface LeakyApi {
        _buffer: Array<string>;
        process(): void;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `export interface Cache {
        "internalMap": Map<string, any>;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
    {
      code: `interface Store {
        internalData: Collections.Map<string, any>;
      }`,
      errors: [
        { messageId: "internalName" },
        { messageId: "exposedCollection" },
      ],
    },
  ],
});
