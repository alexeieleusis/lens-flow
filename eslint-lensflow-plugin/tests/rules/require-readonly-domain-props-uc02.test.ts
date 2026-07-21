import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/require-readonly-domain-props-uc02.js";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

const URL = knowledgeUrl("usecases/UC02-domain-modeling.md");

ruleTester.run("require-readonly-domain-props-uc02", rule, {
  valid: [
    // All readonly — no issues
    `type Order = {
      readonly id: OrderId;
      readonly amount: Money;
      readonly status: OrderStatus;
    };`,
    // Interface with all readonly
    `interface Order {
      readonly id: OrderId;
      readonly amount: Money;
      readonly status: OrderStatus;
    }`,
    // Single property — below default minProperties threshold
    `type Tag = {
      label: string;
    };`,
    // minProperties set to 3, only 2 properties
    {
      code: `type Pair = {
        a: number;
        b: number;
      };`,
      options: [{ minProperties: 3 }],
    },
  ],
  invalid: [
    // Mutable type literal with 3+ properties
    {
      code: `type Order = {
        id: OrderId;
        amount: Money;
        status: OrderStatus;
      };`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "amount", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "status", url: URL } },
      ],
    },
    // Mutable interface with 2+ properties
    {
      code: `interface Payment {
        id: string;
        value: number;
      }`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "value", url: URL } },
      ],
    },
    // Partial readonly — only non-readonly props are flagged
    {
      code: `type Item = {
        readonly id: string;
        name: string;
        price: number;
      };`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "name", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "price", url: URL } },
      ],
    },
    // Mutable type literal with quoted string-literal keys
    {
      code: `type Order = {
        "id": OrderId;
        "amount": Money;
        status: OrderStatus;
      };`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "amount", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "status", url: URL } },
      ],
    },
    // Method signatures are excluded — only properties are flagged
    {
      code: `interface Service {
        id: string;
        name: string;
        process(): void;
      }`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "name", url: URL } },
      ],
    },
    // Computed property key with Identifier — resolves to the identifier name
    {
      code: `type Dynamic = {
        id: string;
        [customKey]: number;
        status: OrderStatus;
      };`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        {
          messageId: "mutableDomainProp",
          data: { name: "customKey", url: URL },
        },
        { messageId: "mutableDomainProp", data: { name: "status", url: URL } },
      ],
    },
    // Computed property key with complex expression — falls back to "?"
    {
      code: `type Dynamic = {
        id: string;
        [getKey()]: number;
        status: OrderStatus;
      };`,
      errors: [
        { messageId: "mutableDomainProp", data: { name: "id", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "?", url: URL } },
        { messageId: "mutableDomainProp", data: { name: "status", url: URL } },
      ],
    },
  ],
});
