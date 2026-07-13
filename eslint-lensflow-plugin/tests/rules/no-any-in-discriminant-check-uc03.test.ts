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
    // `as any` on a nested property of the discriminated object — not the object itself
    `function foo(data: { kind: string; payload: unknown }) {
      if (data.kind === "A") return (data.payload as any).value;
      return null;
    }`,
    // `as any` on nested property inside switch — should not report
    `function foo(data: { kind: string; payload: unknown }) {
      switch (data.kind) {
        case "A": return (data.payload as any).value;
        default: return null;
      }
    }`,
    // `as any` inside a nested arrow function callback — should not cross function boundary
    `function foo(data: { kind: string; [k: string]: unknown }) {
      if (data.kind === "A") {
        const items = [1, 2];
        items.forEach((data) => console.log((data as any).value));
      }
    }`,
    // `as any` inside a nested function expression — should not cross function boundary
    `function foo(data: { kind: string; [k: string]: unknown }) {
      if (data.kind === "A") {
        [1].map(function(data) { return (data as any).value; });
      }
    }`,
    // `as any` inside a nested function declaration — should not cross function boundary
    `function foo(data: { kind: string; [k: string]: unknown }) {
      if (data.kind === "A") {
        function bar(data: unknown) { return (data as any).value; }
        bar(null);
      }
    }`,
    // `as any` inside switch callback — should not cross function boundary
    `function foo(data: { kind: string; [k: string]: unknown }) {
      switch (data.kind) {
        case "A":
          [1].forEach((data) => console.log((data as any).value));
          break;
        default: break;
      }
    }`,
    // Shadowed by let redeclaration inside the same if block
    `function foo(x: { kind: string; [k: string]: unknown }) {
      if (x.kind === "A") {
        let x: unknown = "shadow";
        return (x as any).value;
      }
      return null;
    }`,
    // Shadowed by let redeclaration in a nested block inside switch case
    `function foo(x: { kind: string; [k: string]: unknown }) {
      switch (x.kind) {
        case "A": {
          let x: unknown = "shadow";
          return (x as any).value;
        }
        default: return null;
      }
    }`,
    // Shadowed by catch clause parameter
    `function foo(x: { kind: string; [k: string]: unknown }) {
      if (x.kind === "A") {
        try {
          throw new Error();
        } catch (x) {
          console.log((x as any).message);
        }
      }
    }`,
    // Shadowed by for-loop variable
    `function foo(x: { kind: string; [k: string]: unknown }) {
      if (x.kind === "A") {
        for (let x = 0; x < 3; x++) {
          console.log((x as any).value);
        }
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
    // Discriminant property `tag`
    {
      code: `function foo(msg: { tag: string; [k: string]: unknown }) {
  if (msg.tag === "error") return (msg as any).details;
  return null;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Discriminant property `variant`
    {
      code: `function foo(node: { variant: string; [k: string]: unknown }) {
  switch (node.variant) {
    case "leaf": return (node as any).value;
    default: return null;
  }
}`,
      errors: [{ messageId: "switchDiscriminant" }],
    },
    // Discriminant property `state`
    {
      code: `function handle(machine: { state: string; [k: string]: unknown }) {
  if (machine.state === "running") return (machine as any).pid;
  return null;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Discriminant property `role`
    {
      code: `function getPerm(user: { role: string; [k: string]: unknown }) {
  if (user.role === "admin") return (user as any).permissions;
  return [];
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Discriminant property `name`
    {
      code: `function resolve(tool: { name: string; [k: string]: unknown }) {
  if (tool.name === "compiler") return (tool as any).version;
  return null;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // Discriminant property `discriminant`
    {
      code: `function dispatch(event: { discriminant: string; [k: string]: unknown }) {
  switch (event.discriminant) {
    case "click": return (event as any).target;
    default: return null;
  }
}`,
      errors: [{ messageId: "switchDiscriminant" }],
    },
    // Logical OR with different bases — both casts should be caught
    {
      code: `function foo(left: { kind: string; [k: string]: unknown }, right: { kind: string; [k: string]: unknown }) {
  if (left.kind === "A" || right.kind === "B") {
    return (left as any).x + (right as any).y;
  }
  return null;
}`,
      errors: [
        { messageId: "ifDiscriminant" },
        { messageId: "ifDiscriminant" },
      ],
    },
    // Logical AND with different bases — both casts should be caught
    {
      code: `function foo(a: { kind: string; [k: string]: unknown }, b: { type: string; [k: string]: unknown }) {
  if (a.kind === "X" && b.type === "Y") {
    return (a as any).val + (b as any).val;
  }
  return null;
}`,
      errors: [
        { messageId: "ifDiscriminant" },
        { messageId: "ifDiscriminant" },
      ],
    },
    // Negated discriminant check with `!==`
    {
      code: `function foo(data: { kind: string; [k: string]: unknown }) {
  if (data.kind !== "Circle") return (data as any).value;
  return null;
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
    // `else { throw }` guard pattern — `as any` in if branch should still be caught
    {
      code: `function foo(data: { kind: string; [k: string]: unknown }) {
  if (data.kind === "A") return (data as any).value;
  else throw new Error("invalid kind");
}`,
      errors: [{ messageId: "ifDiscriminant" }],
    },
  ],
});
