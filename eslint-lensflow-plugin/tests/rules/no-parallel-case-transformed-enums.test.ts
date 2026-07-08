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
    // "Database" is not a case transform of "Record"
    `enum Record {
      Foo,
      Bar
    }
    enum Database {
      Baz,
      Qux
    }`,
    // "Forecast" coincidentally ends with "case" suffix but is unrelated to "Legacy"
    `enum Legacy {
      Old,
      New
    }
    enum Forecast {
      OLD,
      NEW
    }`,
    // "Response" coincidentally ends with "str" suffix but is unrelated to "Data"
    `enum Data {
      Alpha,
      Beta
    }
    enum Response {
      ALPHA,
      BETA
    }`,
    // "Address" coincidentally ends with "dress" (not a suffix) — should not flag
    `enum Address {
      Home,
      Work
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
