import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-giant-optional-interface-t59.js";

ruleTester.run("no-giant-optional-interface-t59", rule, {
  valid: [
    `interface SmallConfig {
      text?: string;
      icon?: string;
      onClick?: () => void;
    }`,
    `interface MixedProps {
      requiredField: string;
      optionalField?: number;
      anotherRequired: boolean;
    }`,
    `interface JustUnderLimit {
      a?: string;
      b?: string;
      c?: string;
      d?: string;
      e?: string;
      f?: string;
      g?: string;
      h?: string;
      i?: string;
    }`,
    `type SmallConfig = {
      text?: string;
      icon?: string;
      onClick?: () => void;
    }`,
    `type JustUnderLimit = {
      a?: string;
      b?: string;
      c?: string;
      d?: string;
      e?: string;
      f?: string;
      g?: string;
      h?: string;
      i?: string;
    }`,
    {
      code: `interface ButtonConfig {
        text?: string;
        icon?: string;
        onClick?: () => void;
        onHover?: () => void;
        disabled?: boolean;
        loading?: boolean;
        ariaLabel?: string;
        variant?: string;
        size?: string;
        color?: string;
      }`,
      options: [{ maxOptional: 20 }],
    },
  ],
  invalid: [
    {
      code: `interface ButtonConfig {
        text?: string;
        icon?: string;
        onClick?: () => void;
        onHover?: () => void;
        disabled?: boolean;
        loading?: boolean;
        ariaLabel?: string;
        variant?: string;
        size?: string;
        color?: string;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    {
      code: `interface GiantConfig {
        a?: string;
        b?: string;
        c?: string;
        d?: string;
        e?: string;
        f?: string;
        g?: string;
        h?: string;
        i?: string;
        j?: string;
        k?: string;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    {
      code: `interface ExactlyAtLimit {
        a?: string;
        b?: string;
        c?: string;
        d?: string;
        e?: string;
        f?: string;
        g?: string;
        h?: string;
        i?: string;
        j?: string;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    {
      code: `type Config = {
        a?: string;
        b?: string;
        c?: string;
        d?: string;
        e?: string;
        f?: string;
        g?: string;
        h?: string;
        i?: string;
        j?: string;
      }`,
      errors: [{ messageId: "tooManyOptional" }],
    },
    {
      code: `interface ButtonConfig {
        text?: string;
        icon?: string;
        onClick?: () => void;
        onHover?: () => void;
        disabled?: boolean;
        loading?: boolean;
        ariaLabel?: string;
        variant?: string;
        size?: string;
        color?: string;
      }`,
      options: [{ maxOptional: 5 }],
      errors: [{ messageId: "tooManyOptional" }],
    },
  ],
});
