import { ruleTester } from "../helpers/rule-tester.js";
import rule from "../../src/rules/no-orphaned-abort-controller.js";

ruleTester.run("no-orphaned-abort-controller", rule, {
  valid: [
    // AbortController with .abort() called in a timeout
    `async function search(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(\`/api/search?q=\${query}\`, { signal: controller.signal });
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}`,

    // AbortController with .abort() in finally block
    `async function fetchData(): Promise<void> {
  const controller = new AbortController();
  try {
    await fetch('/api/data', { signal: controller.signal });
  } finally {
    controller.abort();
  }
}`,

    // AbortController with .abort() in catch block
    `async function tryRequest(): Promise<void> {
  const ctrl = new AbortController();
  try {
    await fetch('/api', { signal: ctrl.signal });
  } catch {
    ctrl.abort();
  }
}`,

    // AbortController signal passed as direct arg to signal-accepting function (external cleanup)
    `async function search(query: string): Promise<void> {
  const controller = new AbortController();
  fetch('/api', controller.signal);
}`,

    // Not an AbortController
    `const x = new Map();`,

    // AbortController assigned to destructuring (not tracked)
    `const { ctrl } = { ctrl: new AbortController() };`,

    // Outer-scope .abort() in finally — nested function has its own .abort()
    `async function search(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const handler = () => controller.abort();
  try {
    const res = await fetch(\`/api/search?q=\${query}\`, { signal: controller.signal });
    return res.json();
  } finally {
    controller.abort();
  }
}`,

    // let declaration with .abort() in finally block
    `async function fetchData(): Promise<void> {
  let controller = new AbortController();
  try {
    await fetch('/api/data', { signal: controller.signal });
  } finally {
    controller.abort();
  }
}`,
  ],
  invalid: [
    // Basic antipattern: AbortController never aborted
    {
      code: `async function search(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const res = await myApi(\`/api/search?q=\${query}\`, { signal: controller.signal });
  return res.json();
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Another function with orphaned controller
    {
      code: `async function fetchWithSignal(): Promise<Response> {
  const ac = new AbortController();
  return myFetch('/api/data', { signal: ac.signal });
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Multiple AbortControllers, one orphaned
    {
      code: `async function dualFetch(): Promise<void> {
  const good = new AbortController();
  const bad = new AbortController();
  await myApi('/a', { signal: good.signal });
  good.abort();
  await myApi('/b', { signal: bad.signal });
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // .abort() only inside a nested function — not outer-scope cleanup
    {
      code: `async function search() {
  const controller = new AbortController();
  const handler = () => controller.abort();
  doSomething(controller.signal);
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Variable shadowing: nested scope redeclares same name, outer controller is orphaned
    {
      code: `async function outer() {
  const controller = new AbortController();
  async function inner() {
    const controller = new AbortController();
    await fetch("/a", { signal: controller.signal });
    controller.abort();
  }
  process(controller.signal);
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Expression-bodied arrow function with orphaned AbortController
    {
      code: `const fn = () => fetch("/api", { signal: new AbortController().signal });`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // var declaration with orphaned AbortController
    {
      code: `async function fetchWithSignal(): Promise<Response> {
  var ac = new AbortController();
  return myFetch('/api/data', { signal: ac.signal });
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },
  ],
});
