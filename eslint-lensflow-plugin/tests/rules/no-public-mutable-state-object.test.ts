import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-public-mutable-state-object.js";

ruleTester.run("no-public-mutable-state-object", rule, {
  valid: [
    // Name doesn't match stateful entity pattern
    `interface Config {
      port: number;
      host: string;
    }`,
    // No mutable state properties (all readonly)
    `type AccountState = {
      readonly balance: number;
      readonly transactions: string[];
    };`,
    // No mutable state properties (no numeric/string/array types)
    `interface Wallet {
      readonly id: string;
      owner: boolean;
    }`,
    // Name matches but only has readonly numeric properties
    `type BalanceTracker = {
      readonly balance: number;
      readonly total: number;
    };`,
    // Class is fine (not a plain type/interface)
    `class Account {
      #balance = 0;
      withdraw(amount: number): void {
        this.#balance -= amount;
      }
    }`,
    // Stateful name but no mutable numeric/string/array props
    `interface State {
      isActive: boolean;
      label: "on" | "off";
    }`,
  ],
  invalid: [
    {
      code: `type Account = {
        balance: number;
        transactions: string[];
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    {
      code: `interface Wallet {
        balance: number;
        owner: string;
      }`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    {
      code: `type Counter = {
        count: number | string;
        labels: string[];
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    {
      code: `interface State {
        value: number;
      }`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    {
      code: `type Balance = {
        amount: number;
        history: string[];
        readonly id: string;
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    // Array<T> (TSTypeReference)
    {
      code: `type Account = {
        balance: number;
        items: Array<number>;
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    // ReadonlyArray<T> (TSTypeReference)
    {
      code: `type Wallet = {
        transactions: ReadonlyArray<string>;
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    // Quoted string-literal key
    {
      code: `type BalanceTracker = {
        "balance": number;
        "owner": string;
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    // Parenthesized type (TSParenthesizedType)
    {
      code: `type Counter = {
        count: (number);
        label: (string);
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
    // Intersection type (TSIntersectionType)
    {
      code: `type State = {
        value: number & { tag: "x" };
      };`,
      errors: [{ messageId: "mutableStateObject" }],
    },
  ],
});
