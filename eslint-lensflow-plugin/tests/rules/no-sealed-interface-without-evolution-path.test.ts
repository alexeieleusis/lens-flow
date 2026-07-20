import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-sealed-interface-without-evolution-path.js";

ruleTester.run("no-sealed-interface-without-evolution-path", rule, {
  valid: [
    // No sealed symbol — normal interface
    `export interface Payment {
      charge(amount: number): Promise<void>;
      refund?(): Promise<void>;
    }`,
    // Sealed interface with optional property (has evolution path — TSPropertySignature)
    `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund?(): Promise<void>;
}`,
    // Sealed interface with optional method signature (has evolution path — TSMethodSignature)
    `declare const _sealed: unique symbol;

export interface Wallet {
  readonly [_sealed]: never;
  deposit(amount: number): void;
  withdraw?(amount: number): Promise<void>;
}`,
    // Sealed interface with 5+ members (not brittle by count)
    // Boundary: exactly 5 total members (>= 5, not brittle)
    `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund(): Promise<void>;
  status(): string;
  amount(): number;
}`,
    // Above boundary: 6 total members
    `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund(): Promise<void>;
  status(): string;
  amount(): number;
  cancel(): Promise<void>;
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
    {
      code: `export interface Payment {
  readonly ["_sealed"]: never;
  charge(amount: number): Promise<void>;
}`,
      errors: [{ messageId: "sealedNoEvolution" }],
    },
    // Sealed interface with all required methods — no optional TSMethodSignature (brittle)
    {
      code: `declare const _sealed: unique symbol;

export interface Wallet {
  readonly [_sealed]: never;
  deposit(amount: number): void;
  withdraw(amount: number): Promise<void>;
}`,
      errors: [{ messageId: "sealedNoEvolution" }],
    },
    // Boundary: exactly 4 members total (< 5, brittle)
    {
      code: `declare const _sealed: unique symbol;

export interface Payment {
  readonly [_sealed]: never;
  charge(amount: number): Promise<void>;
  refund(): Promise<void>;
  status(): string;
}`,
      errors: [{ messageId: "sealedNoEvolution" }],
    },
  ],
});
