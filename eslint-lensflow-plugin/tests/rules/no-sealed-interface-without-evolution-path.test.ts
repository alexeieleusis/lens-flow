import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-sealed-interface-without-evolution-path.js";

ruleTester.run("no-sealed-interface-without-evolution-path", rule, {
  valid: [
    // No sealed symbol — normal interface
    `export interface Payment {
      charge(amount: number): Promise<void>;
      refund?(): Promise<void>;
    }`,
    // Sealed interface with optional member (has evolution path)
    `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund?(): Promise<void>;
}`,
    // Sealed interface with 5+ members (not brittle by count)
    `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund(): Promise<void>;
  status(): string;
  amount(): number;
}`,
    // Computed key but identifier does not start with underscore
    `declare const brand: unique symbol;

export interface Payment {
  readonly [brand]: never;
  charge(amount: number): Promise<void>;
}`,
  ],
  invalid: [
    {
      code: `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
}`,
      errors: [{ messageId: "sealedNoEvolution" }],
    },
    {
      code: `declare const _brand: unique symbol;

export interface Config {
  [_brand]: never;
  getValue(): string;
}`,
      errors: [{ messageId: "sealedNoEvolution" }],
    },
  ],
});
