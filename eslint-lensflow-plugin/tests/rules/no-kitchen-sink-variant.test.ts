import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-kitchen-sink-variant.js";

ruleTester.run("no-kitchen-sink-variant", rule, {
  valid: [
    `type ApiResponse =
      | { kind: "user"; data: { name: string; email: string } }
      | { kind: "post"; data: { title: string; content: string } };`,
    `type ApiResponse =
      | { kind: "user"; name: string; email: string }
      | { kind: "post"; title: string; content: string };`,
    `type Small = { a: string; b: number; c: boolean; d: string; e: number };`,
    `type ApiResponse =
      | { kind: "user"; name: string; email: string; age: number; role: string; avatar: string; data: boolean }
      | { kind: "post"; title: string; content: string };`,
    `type ApiResponse = {
      kind: "user";
      name: string;
      email: string;
      age: number;
      role: string;
      avatar: string;
    };`,
    `type ApiResponse =
      | { kind: "user"; name: string; email: string; age: number; role: string; avatar: string }
      | { kind: "post"; title: string; content: string; authorId: number; tags: string[]; views: number };`,
    `type ApiResponse =
      | { kind: "user"; name: string; email: string; age: number; role: string; avatar: string }
      | { kind: "post"; title: string; content: string };`,
    `type ApiResponse =
      | { kind: "post"; title: string; content: string; authorId: number; tags: string[]; views: number }
      | { kind: "comment"; id: string; text: string; parentId: number; createdAt: Date; updatedAt: Date };`,
    `type ApiResponse =
      | { kind: "user"; "data": { name: string; email: string; age: number; role: string; avatar: string; extra: boolean } }
      | { kind: "post"; title: string; content: string };`,
  ],
  invalid: [
    {
      code: `type ApiResponse =
      | { kind: "user"; name: string; email: string; age: number; role: string; avatar: string; phone: string }
      | { kind: "post"; title: string; content: string };`,
      errors: [{ messageId: "tooManyFields" }],
    },
    {
      code: `type ApiResponse =
      | { kind: "post"; title: string; content: string; authorId: number; tags: string[]; views: number; likes: number; shares: number }
      | { kind: "comment"; id: string; text: string };`,
      errors: [{ messageId: "tooManyFields" }],
    },
    {
      code: `type Config =
      | { kind: "a"; a: string; b: string; c: string; d: string; e: string }
      | { kind: "b"; x: number };`,
      options: [{ maxFields: 5 }],
      errors: [{ messageId: "tooManyFields" }],
    },
  ],
});
