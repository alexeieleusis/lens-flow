import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-in-discriminant-check-uc03.js";

ruleTester.run("no-any-in-discriminant-check-uc03", rule, {
  valid: [
    // Proper discriminated union with narrowing — no `as any` needed
    `type Shape =
      | { kind: "Circle"; radius: number }
      | { kind: "Rectangle"; width: number; height: number };

    function area(s: Shape): number {
      switch (s.kind) {
        case "Circle": return Math.PI * s.radius ** 2;
        case "Rectangle": return s.width * s.height;
        default: throw new Error("unknown");
      }
    }`,
    // `as any` not inside any discriminant-checking conditional
    `function foo(data: any) {
      return (data as any).value;
    }`,
    // `as any` inside an if that doesn't check a discriminant on the same object
    `function foo(data: { x: number }) {
      if (data.x > 0) return (data as any).extra;
      return null;
    }`,
    // `as any` on a different object than the discriminant check
    `function foo(data: { kind: string }, other: unknown) {
      if (data.kind === "A") return (other as any).value;
      return null;
    }`,
    // `as any` inside a switch on a different object
    `function foo(data: { kind: string }, other: unknown) {
      switch (data.kind) {
        case "A": return (other as any).value;
        default: return null;
      }
    }`,
  ],
  invalid: [
    // `as any` on data inside if checking data.kind
    {
      code: `type ShapeData = { kind: string } & Record<string, unknown>;

function area(data: ShapeData): number {
  if (data.kind === "Circle" && "radius" in data)
    return Math.PI * (data as any).radius ** 2;
  return 0;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Multiple `as any` on data inside if checking data.kind
    {
      code: `type ShapeData = { kind: string } & Record<string, unknown>;

function area(data: ShapeData): number {
  if (data.kind === "Rectangle")
    return (data as any).width * (data as any).height;
  return 0;
}`,
      errors: [
        { messageId: "ifDiscriminant" },
        { messageId: "ifDiscriminant" },
      ],
    },
    // `as any` on s inside switch on s.kind
    {
      code: `type ShapeData = { kind: string } & Record<string, unknown>;

function area(s: ShapeData): number {
  switch (s.kind) {
    case "Circle": return Math.PI * (s as any).radius ** 2;
    case "Rectangle": return (s as any).width * (s as any).height;
    default: return 0;
  }
}`,
      errors: [
        { messageId: "switchDiscriminant" },
        { messageId: "switchDiscriminant" },
        { messageId: "switchDiscriminant" },
      ],
    },
    // Discriminant property `type`
    {
      code: `function process(item: { type: string; [k: string]: unknown }) {
  if (item.type === "foo") return (item as any).special;
  return null;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Discriminant property `status`
    {
      code: `function handle(req: { status: string; [k: string]: unknown }) {
  switch (req.status) {
    case "ok": return (req as any).body;
    default: return null;
  }
}`,
      errors: [{ messageId: "switchDiscriminant" }],
    },
  ],
});
