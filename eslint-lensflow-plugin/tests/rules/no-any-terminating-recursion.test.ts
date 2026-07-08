import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-any-terminating-recursion.js";

ruleTester.run("no-any-terminating-recursion", rule, {
  valid: [
    // Properly typed recursive type — no any/unknown
    `type ProperlyRecursive = {
      children: ProperlyRecursive[];
      value: string | number | undefined;
    };`,
    // Non-recursive type with any should not trigger
    `type NotRecursive = {
      value: any;
    };`,
    // Recursive type with no any/unknown in the value field
    `interface Tree {
      children: Tree[];
      label: string;
    }`,
    // Deeply nested but no any/unknown
    `type Node = {
      next: Node | null;
      data: { a: string; b: number };
    };`,
    // Callable interface with no any/unknown
    `interface CallableRec {
      (x: string): CallableRec;
      label: number;
    }`,
    // Construct signature with no any/unknown
    `interface ConstructRec {
      new (n: number): ConstructRec;
      value: string;
    }`,
  ],
  invalid: [
    // any in a self-referential recursive type (type alias)
    {
      code: `type LooselyRecursive = {
  children: LooselyRecursive[];
  value: any;
};`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // unknown in a self-referential recursive type (type alias)
    {
      code: `type WeakNode = {
  next: WeakNode | null;
  payload: unknown;
};`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // any in a self-referential recursive interface
    {
      code: `interface WeakTree {
  children: WeakTree[];
  value: any;
}`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // unknown in a self-referential recursive interface
    {
      code: `interface WeakTree {
  children: WeakTree[];
  value: unknown;
}`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // any nested deeper inside recursive type
    {
      code: `type DeepNode = {
  children: DeepNode[];
  metadata: { raw: any };
};`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // any in call signature param of self-referential interface
    {
      code: `interface CallableWeak {
  (x: any): CallableWeak;
}`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // unknown in call signature return of self-referential interface
    {
      code: `interface CallableUnknown {
  (n: number): CallableUnknown;
  result: unknown;
}`,
      errors: [{ messageId: "anyInRecursive" }],
    },
    // any in construct signature of self-referential interface
    {
      code: `interface ConstructWeak {
  new (data: any): ConstructWeak;
  children: ConstructWeak[];
}`,
      errors: [{ messageId: "anyInRecursive" }],
    },
  ],
});
