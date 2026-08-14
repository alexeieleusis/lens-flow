import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/prefer-primitive-method-params.js";

ruleTester.run("prefer-primitive-method-params", rule, {
  valid: [
    // Multiple properties accessed — not a single-property extraction
    `class User {
      #name: string;
      setName(data: { name: string; email: string }) {
        this.#name = data.name;
        console.log(data.email);
      }
    }`,
    // Object passed as whole to another call
    `function process(data: { name: string }) {
      validate(data);
    }`,
    // Destructuring usage
    `function greet(data: { name: string }) {
      const { name } = data;
      console.log(name);
    }`,
    // Non-object parameter type
    `function setName(name: string) {
      console.log(name);
    }`,
    // Arrow function accessing multiple properties
    `const handler = (data: { name: string; age: number }) => {
      console.log(data.name, data.age);
    };`,
    // Nested function accessing single property — walk stops at function boundary
    `class User {
      setName(data: { name: string }) {
        const fn = () => data.name;
        fn();
      }
    }`,
    // Readonly property — caller can't mutate through this reference
    `function extractName(info: { readonly name: string }) {
      return info.name;
    }`,
    // React function component (function declaration), detected via return type —
    // props must stay an object even though only one prop is read
    `function CounterDisplayHost(props: { initialCount: number }): React.ReactElement {
      return renderCounter(props.initialCount);
    }`,
    // React function component (JSX.Element return type, no JSX detected in body)
    `function Icon(props: { name: string }): JSX.Element {
      return render(props.name);
    }`,
    // React function component (arrow function, implicit JSX return)
    {
      code: `const Greeting = (props: { name: string }) => <div>{props.name}</div>;`,
      languageOptions: {
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
    // SonarQube-recommended `Readonly<Props>` form — a type reference, not an
    // inline object literal, so it's outside this rule's scope regardless of
    // how many properties are read
    `interface PropsType { initialCount: number }
    function Component(props: Readonly<PropsType>): React.ReactElement {
      return renderCounter(props.initialCount);
    }`,
    // Same but with the object literal wrapped inline in `Readonly<...>`
    `function Component(props: Readonly<{ initialCount: number }>): React.ReactElement {
      return renderCounter(props.initialCount);
    }`,
  ],
  invalid: [
    {
      code: `class User {
      #name: string;
      setName(data: { name: string }) {
        this.#name = data.name;
      }
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function extractName(info: { name: string }) {
      return info.name;
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `const getName = (payload: { name: string }) => payload.name;`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function setLabel(config: { label: string }) {
      document.title = config.label;
      log(config.label);
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    {
      code: `function f(data: { name: string }) { return data["name"]; }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    // Mutable property still flags even when the parameter also has a readonly sibling
    {
      code: `function extractName(info: { readonly id: string; name: string }) {
      return info.name;
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
    // PascalCase name alone isn't enough to be treated as a component — must return JSX
    {
      code: `function Factory(config: { size: number }) {
      return config.size * 2;
    }`,
      errors: [{ messageId: "preferPrimitive" }],
    },
  ],
});
