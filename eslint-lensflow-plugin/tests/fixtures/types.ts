export type PaymentStatus =
  { kind: "pending"; amount: number } | { kind: "complete"; amount: number };
