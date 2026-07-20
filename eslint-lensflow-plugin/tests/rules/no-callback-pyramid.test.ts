import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-callback-pyramid.js";

ruleTester.run("no-callback-pyramid", rule, {
  valid: [
    // Two levels of nesting is below the default threshold of 3
    `getUser(id, (err, user) => {
      if (err) return handleError(err);
      getOrders(user.id, (err, orders) => {
        if (err) return handleError(err);
        render({ user, orders });
      });
    });`,
    // No callback nesting at all
    `async function loadData(id: string) {
      const user = await fetchUser(id);
      const orders = await fetchOrders(user.id);
      return { user, orders };
    }`,
    // Callback without nesting
    `fetchData(url, (err, data) => {
      if (err) return handleError(err);
      console.log(data);
    });`,
    // Arrow function callbacks with only one level
    `api.call((data) => {
      process(data);
    });`,
    // Non-callback function calls (last arg is not a callback)
    `getUser(id, callback, options);`,
    // Correct async/await pattern with Promise.all
    `async function loadData(id: string) {
      const user = await fetchUser(id);
      const [orders, tags] = await Promise.all([
        fetchOrders(user.id),
        fetchTags(user.id),
      ]);
      render({ user, orders, tags });
    }`,
    // Callback at exactly depth 2 (below threshold)
    `a((err, r1) => {
      b(r1, (err, r2) => {
        console.log(r2);
      });
    });`,
    // minDepth: 4 — three levels of nesting should NOT report when threshold is raised
    {
      code: `getUser(id, (err, user) => {
        if (err) return handleError(err);
        getOrders(user.id, (err, orders) => {
          if (err) return handleError(err);
          getTags(user.id, (err, tags) => {
            if (err) return handleError(err);
            render({ user, orders, tags });
          });
        });
      });`,
      options: [{ minDepth: 4 }],
    },
    // minDepth: 4 — two levels should NOT report
    {
      code: `getUser(id, (err, user) => {
        if (err) return handleError(err);
        getOrders(user.id, (err, orders) => {
          render({ user, orders });
        });
      });`,
      options: [{ minDepth: 4 }],
    },
    // Expression-bodied arrow — valid (depth 2, below threshold)
    `a(() => b(() => c()));`,
    // Expression-bodied arrow at depth 2 with options
    {
      code: `a(() => b(() => c()));`,
      options: [{ minDepth: 4 }],
    },
  ],
  invalid: [
    // Three levels of nested callbacks — the antipattern from the spec
    {
      code: `getUser(id, (err, user) => {
        if (err) return handleError(err);
        getOrders(user.id, (err, orders) => {
          if (err) return handleError(err);
          getTags(user.id, (err, tags) => {
            if (err) return handleError(err);
            render({ user, orders, tags });
          });
        });
      });`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Four levels of nesting with function expressions
    {
      code: `step1(function (err, r1) {
        if (err) return done(err);
        step2(r1, function (err, r2) {
          if (err) return done(err);
          step3(r2, function (err, r3) {
            if (err) return done(err);
            step4(r3, function (err, r4) {
              finish(r4);
            });
          });
        });
      });`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Arrow function pyramid pattern
    {
      code: `fetchA(() => {
        fetchB(() => {
          fetchC(() => {
            render();
          });
        });
      });`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Mixed arrow and function expression callbacks
    {
      code: `readFile("a.txt", (err, data) => {
        if (err) return;
        writeFile("b.txt", data, function (err) {
          if (err) return;
          readFile("c.txt", (err, result) => {
            console.log(result);
          });
        });
      });`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Three levels with function declarations
    {
      code: `function loadAll(id: string) {
        getFirst(id, (err, r1) => {
          if (err) return handleError(err);
          getSecond(r1.id, (err, r2) => {
            if (err) return handleError(err);
            getThird(r2.id, (err, r3) => {
              console.log(r3);
            });
          });
        });
      }`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // minDepth: 2 — two levels of nesting SHOULD report when threshold is lowered
    {
      code: `getUser(id, (err, user) => {
        if (err) return handleError(err);
        getOrders(user.id, (err, orders) => {
          if (err) return handleError(err);
          render({ user, orders });
        });
      });`,
      options: [{ minDepth: 2 }],
      errors: [{ messageId: "callbackPyramid" }],
    },
    // minDepth: 2 — exactly two levels (minimal nesting) should report
    {
      code: `a((err, r1) => {
        b(r1, (err, r2) => {
          console.log(r2);
        });
      });`,
      options: [{ minDepth: 2 }],
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Expression-bodied arrow — invalid (depth 3)
    {
      code: `a(() => b(() => c(() => d())));`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Expression-bodied arrow — invalid (depth 4)
    {
      code: `a(() => b(() => c(() => d(() => e()))));`,
      errors: [{ messageId: "callbackPyramid" }],
    },
    // Expression-bodied arrow with minDepth: 2
    {
      code: `a(() => b(() => c()));`,
      options: [{ minDepth: 2 }],
      errors: [{ messageId: "callbackPyramid" }],
    },
  ],
});
