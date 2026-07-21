import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-string-match-error-handling.js";

ruleTester.run("no-string-match-error-handling", rule, {
  valid: [
    `try {
  const data = process(input);
} catch (e) {
  if (e instanceof NotFoundError) {
    handleNotFound();
  } else if (e instanceof TimeoutError) {
    handleTimeout();
  }
}`,
    `const result = process(input);
if (!result.ok) {
  switch (result.error.kind) {
    case "NotFound": handleNotFound(); break;
    case "Timeout": handleTimeout(); break;
    default: assertNever(result.error);
  }
}`,
    `try {
  const data = process(input);
} catch (e) {
  console.error(e);
  throw e;
}`,
    `try {
  const data = process(input);
} catch (e) {
  if (e.code === "ENOENT") {
    handleNotFound();
  }
}`,
    `try {
  const data = process(input);
} catch (err) {
  if (outerError.message.includes("not found")) {
    handleNotFound();
  }
}`,
    // Destructuring catch parameter — rule early-returns for non-Identifier catch params.
    `try {
  const data = process(input);
} catch ({ message }) {
  console.error(message);
}`,
    // Missing catch parameter — rule early-returns when catchParam is null.
    `try {
  const data = process(input);
} catch {
  console.error("Something went wrong");
}`,
    // Nested arrow function in catch body — walker stops at function boundary,
    // so the inner `e` (shadowing the outer catch param) is not flagged.
    `try {
  const data = process(input);
} catch (e) {
  items.forEach((e) => {
    if (e.message.includes("bad")) {
      handleBad(e);
    }
  });
}`,
  ],
  invalid: [
    // Nested catch handler inside arrow function — the inner catch's string match IS reported.
    {
      code: `try {
  const data = process(input);
} catch (err) {
  items.forEach((item) => {
    try {
      transform(item);
    } catch (err) {
      if (err.message.includes("transform failed")) {
        skipItem(item);
      }
    }
  });
}`,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  const data = process(input);
} catch (e) {
  if (e.message.includes("not found")) {
    handleNotFound();
  } else if (e.message.includes("timeout")) {
    handleTimeout();
  }
}`,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  fetchData();
  parseData();
} catch (err) {
  if (err.message.match(/timeout/i)) {
    handleTimeout();
  } else if (err.name.includes("Network")) {
    handleNetwork();
  }
}`,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  const result = api.call();
} catch (e) {
  if (e.message.startsWith("Connection")) {
    reconnect();
  }
}`,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  process();
} catch (e) {
  if (e.message.indexOf("error") !== -1) {
    handleError();
  }
}`,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  fetchData();
} catch (err) {
  if (err.name.includes("Network")) {
    handleNetwork();
  }
}
      `,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  const data = process(input);
} catch (e) {
  if (e.message.search(/not found/i) !== -1) {
    handleNotFound();
  }
}
      `,
      errors: [{ messageId: "stringMatchOnError" }],
    },
    {
      code: `try {
  api.call();
} catch (err) {
  if (err.message.endsWith("timeout")) {
    handleTimeout();
  }
}
      `,
      errors: [{ messageId: "stringMatchOnError" }],
    },
  ],
});
