import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-parallel-case-transformed-enums.js";

ruleTester.run("no-parallel-case-transformed-enums", rule, {
  valid: [
    `enum Direction {
      North,
      South,
      East,
      West
    }`,
    `type Direction = "north" | "south" | "east" | "west";
type DirectionUpper = Uppercase<Direction>;`,
    `enum Color {
      Red,
      Green,
      Blue
    }
    enum Size {
      Small,
      Medium,
      Large
    }`,
    `enum Status {
      Active,
      Inactive
    }
    enum Priority {
      HIGH,
      LOW
    }`,
  ],
  invalid: [
    {
      code: `enum Direction {
        North,
        South,
        East,
        West
      }
      enum DirectionUpper {
        NORTH,
        SOUTH,
        EAST,
        WEST
      }`,
      errors: [{ messageId: "parallelCaseEnum" }],
    },
    {
      code: `enum Color {
        Red,
        Green,
        Blue
      }
      enum ColorSnake {
        RED,
        GREEN,
        BLUE
      }`,
      errors: [{ messageId: "parallelCaseEnum" }],
    },
    {
      code: `enum Status {
        Active,
        Inactive
      }
      enum StatusConst {
        ACTIVE,
        INACTIVE
      }`,
      errors: [{ messageId: "parallelCaseEnum" }],
    },
  ],
});
