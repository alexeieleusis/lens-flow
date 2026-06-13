import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-bivariant-method-syntax-uc17.js";

ruleTester.run("no-bivariant-method-syntax-uc17", rule, {
  valid: [
    `interface Service {
  onAdd: (c: Cat) => void;
}`,
    `type Service = {
  onAdd: (c: Cat) => void;
}`,
    `interface Service {
  name: string;
  onAdd: (c: Cat) => void;
}`,
  ],
  invalid: [
    {
      code: `interface Service {
  onAdd(c: Cat): void;
}`,
      errors: [{ messageId: "methodSyntax" }],
    },
    {
      code: `type Service = {
  onAdd(c: Cat): void;
}`,
      errors: [{ messageId: "methodSyntax" }],
    },
    {
      code: `interface Handler {
  onAdd(c: Cat): void;
  onRemove(c: Cat): void;
}`,
      errors: [
        { messageId: "methodSyntax" },
        { messageId: "methodSyntax" },
      ],
    },
    {
      code: `interface Service {
  onAdd(c: Cat): void;
  name: string;
}`,
      errors: [{ messageId: "methodSyntax" }],
    },
  ],
});
