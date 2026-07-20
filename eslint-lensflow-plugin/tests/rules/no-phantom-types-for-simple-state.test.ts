import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-phantom-types-for-simple-state.js";

ruleTester.run("no-phantom-types-for-simple-state", rule, {
  valid: [
    `type DoorState = "open" | "closed";`,
    `type Door = {
      state: "open" | "closed";
      label: string;
    };`,
    `interface Door {
      state: "open" | "closed";
      label: string;
    }`,
    `type Box<T> = { value: T };`,
    `type Brand<T> = { _brand: T };`,
    `type Door<State extends "open" | "closed"> = {
      _state: State;
      label: string;
    };`,
    `type Door<S extends "open" | "closed"> = { state: S; count: number };`,
    `type Box<T, S extends "open" | "closed"> = { _state: S; value: T };`,
  ],
  invalid: [
    {
      code: `type Door<State extends "open" | "closed"> = { _state: State };`,
      errors: [{ messageId: "phantomTypeOveruse" }],
    },
    {
      code: `type Widget<K extends "a" | "b" | "c"> = { _kind: K };`,
      errors: [{ messageId: "phantomTypeOveruse" }],
    },
    {
      code: `interface Door<State extends "open" | "closed"> { _state: State }`,
      errors: [{ messageId: "phantomTypeOveruse" }],
    },
    {
      code: `type Status<S extends "pending" | "done"> = { _phantom: S };`,
      errors: [{ messageId: "phantomTypeOveruse" }],
    },
  ],
});
