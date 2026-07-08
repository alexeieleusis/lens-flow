import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-deep-inheritance-chain.js";

ruleTester.run("no-deep-inheritance-chain", rule, {
  valid: [
    `class Reader {}`,
    `class Reader {}
class FileReader extends Reader {}
class BufferedReader extends FileReader {}`,
    `class A extends B {}
class B extends A {}`,
    `interface Reader { read(): string; }
class ReaderImpl implements Reader { read() { return ""; } }
class BufferedReaderImpl implements Reader {
  constructor(private inner: Reader) {}
  read() { return this.inner.read(); }
}`,
    // Nested class inside a function should not be tracked
    `function foo() { class Inner extends Outer {} }`,
    // Class inside another class (class property) should not be tracked
    `class Outer { inner = class Inner extends Base {} }`,
  ],
  invalid: [
    {
      code: `class Reader {}
class FileReader extends Reader {}
class BufferedReader extends FileReader {}
class ErrorHandlingBufferedReader extends BufferedReader {}`,
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `class A {}
class B extends A {}
class C extends B {}
class D extends C {}
class E extends D {}`,
      errors: [{ messageId: "deepChain" }, { messageId: "deepChain" }],
    },
    {
      code: `class Base {}
class Level1 extends Base {}
class Level2 extends Level1 {}
class Level3 extends Level2 {}`,
      options: [{ maxDepth: 3 }],
      errors: [{ messageId: "deepChain" }],
    },
    {
      code: `class Base {}
class Level1 extends Base {}
class Level2 extends Level1 {}
class Level3 extends Level2 {}`,
      options: [{ maxDepth: 2 }],
      errors: [{ messageId: "deepChain" }, { messageId: "deepChain" }],
    },
    {
      code: `class Base {}
class Child extends Base {}`,
      options: [{ maxDepth: 1 }],
      errors: [{ messageId: "deepChain" }],
    },
  ],
});
