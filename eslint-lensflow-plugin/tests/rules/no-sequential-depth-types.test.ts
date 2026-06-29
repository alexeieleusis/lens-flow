import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-sequential-depth-types.js";

ruleTester.run("no-sequential-depth-types", rule, {
  valid: [
    // Recursive type - the correct pattern
    `type Folder = {
      id: string;
      children?: Folder[];
    };`,
    // Only 2 members in the group - not enough
    `type Level1 = { id: string; children?: Level2[] };
type Level2 = { id: string };`,
    // 3 members but broken chain (Level1 doesn't reference Level2)
    `type Level1 = { id: string };
type Level2 = { id: string; children?: Level3[] };
type Level3 = { id: string };`,
    // No numeric suffix - shouldn't match
    `type Node = { id: string; children?: Node[] };`,
    // Different base names, each with only 2 members - not enough for either
    `type Alpha1 = { id: string; children?: Alpha2[] };
type Alpha2 = { id: string };
type Beta1 = { id: string; children?: Beta2[] };
type Beta2 = { id: string };`,
  ],
  invalid: [
    // Non-array reference is also a depth chain
    {
      code: `type Level1 = { id: string; next?: Level2 };
type Level2 = { id: string; next?: Level3 };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // The canonical antipattern from the spec
    {
      code: `type Level1 = { id: string; children?: Level2[] };
type Level2 = { id: string; children?: Level3[] };
type Level3 = { id: string; children?: Level4[] };
type Level4 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Minimal 3-member chain
    {
      code: `type Node1 = { id: string; children?: Node2[] };
type Node2 = { id: string; children?: Node3[] };
type Node3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Chain with gap - Depth1-Depth4 form chain, Depth5-Depth6 only 2 members
    {
      code: `type Depth1 = { id: string; children?: Depth2[] };
type Depth2 = { id: string; children?: Depth3[] };
type Depth3 = { id: string; children?: Depth4[] };
type Depth4 = { id: string };
type Depth5 = { id: string; children?: Depth6[] };
type Depth6 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Multiple separate chains
    {
      code: `type Tree1 = { id: string; children?: Tree2[] };
type Tree2 = { id: string; children?: Tree3[] };
type Tree3 = { id: string };
type Level1 = { id: string; children?: Level2[] };
type Level2 = { id: string; children?: Level3[] };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Array<T> syntax - should be detected same as T[]
    {
      code: `type Level1 = { id: string; children?: Array<Level2> };
type Level2 = { id: string; children?: Array<Level3> };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // ReadonlyArray<T> syntax - should be detected same as T[]
    {
      code: `type Level1 = { id: string; children?: ReadonlyArray<Level2> };
type Level2 = { id: string; children?: ReadonlyArray<Level3> };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // readonly T[] syntax - should be detected same as T[]
    {
      code: `type Level1 = { id: string; children?: readonly Level2[] };
type Level2 = { id: string; children?: readonly Level3[] };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Union-wrapped array type - should detect array inside union
    {
      code: `type Level1 = { id: string; children?: Level2[] | null };
type Level2 = { id: string; children?: Level3[] | null };
type Level3 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Namespaced (qualified) type references - should detect the chain
    {
      code: `namespace NS {
  export type Level1 = { id: string; children?: NS.Level2[] };
  export type Level2 = { id: string; children?: NS.Level3[] };
  export type Level3 = { id: string };
}`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
    // Non-consecutive numbering - chain should still be detected by reference, not numeric gap
    {
      code: `type Level1 = { id: string; children?: Level3[] };
type Level3 = { id: string; children?: Level5[] };
type Level5 = { id: string };`,
      errors: [
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
        { messageId: "sequentialDepthType" },
      ],
    },
  ],
});
