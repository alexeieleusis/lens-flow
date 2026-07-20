import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-private-constructor-unvalidated-factory.js";

ruleTester.run("no-private-constructor-unvalidated-factory", rule, {
  valid: [
    String.raw`class Email {
  private constructor(private readonly value: string) {}
  static create(value: string): Email | null {
    return /.+@.+\..+/.test(value) ? new Email(value) : null;
  }
}`,
    `class User {
  constructor(public readonly name: string) {}
  static from(name: string): User {
    return new User(name);
  }
}`,
    `class Token {
  private constructor(private readonly value: string) {}
  static create(value: string): Token {
    if (!value) throw new Error("Empty token");
    return new Token(value);
  }
}`,
    `class Id {
  private constructor(private readonly value: string) {}
  static create(value: string): Id {
    validate(value);
    return new Id(value);
  }
}`,
    `class Safe {
  private constructor(private readonly value: string) {}
  static from(value: string): string {
    return value.toUpperCase();
  }
}`,
    `class NestedTry {
  private constructor(private readonly value: string) {}
  static create(v: string): NestedTry {
    try { validate(v); } catch {}
    return new NestedTry(v);
  }
}`,
    `class ElseThrow {
  private constructor(private readonly value: string) {}
  static create(v: string): ElseThrow {
    if (v) return new ElseThrow(v);
    else { throw new Error("empty"); }
  }
}`,
  ],
  invalid: [
    {
      code: `class Email {
  private constructor(private readonly value: string) {}
  static create(value: string): Email {
    return new Email(value);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
    {
      code: `class Url {
  private constructor(private readonly value: string) {}
  static make(value: string): Url {
    return new Url(value);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
    {
      code: `class Address {
  private constructor(private readonly value: string) {}
  static of(value: string): Address {
    const trimmed = value.trim();
    return new Address(trimmed);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
    {
      code: String.raw`class Foo {
  private constructor(private readonly value: string) {}
  static create(v: string): Foo {
    if (Math.random() > 0.5) return;
    return new Foo(v);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
    {
      code: `class Bar {
  private constructor(private readonly value: string) {}
  static create(v: string): Bar {
    if (Math.random() > 0.5) { return; }
    return new Bar(v);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
    {
      code: String.raw`class Baz {
  private constructor(private readonly value: string) {}
  static create(v: string): Baz {
    if (Math.random() > 0.5) console.log("debug");
    return new Baz(v);
  }
}`,
      errors: [{ messageId: "unvalidatedFactory" }],
    },
  ],
});
