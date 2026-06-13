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

    // AbortController signal passed to another function (external cleanup)
    `async function search(query: string): Promise<void> {
  const controller = new AbortController();
  executeWithTimeout(controller.signal, () => fetch('/api', { signal: controller.signal }));
}`,

    // Not an AbortController
    `const x = new Map();`,

    // AbortController assigned to destructuring (not tracked)
    `const { ctrl } = { ctrl: new AbortController() };`,
  ],
  invalid: [
    // Basic antipattern: AbortController never aborted
    {
      code: `async function search(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const res = await fetch(\`/api/search?q=\${query}\`, { signal: controller.signal });
  return res.json();
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Another function with orphaned controller
    {
      code: `async function fetchWithSignal(): Promise<Response> {
  const ac = new AbortController();
  return fetch('/api/data', { signal: ac.signal });
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },

    // Multiple AbortControllers, one orphaned
    {
      code: `async function dualFetch(): Promise<void> {
  const good = new AbortController();
  const bad = new AbortController();
  await fetch('/a', { signal: good.signal });
  good.abort();
  await fetch('/b', { signal: bad.signal });
}`,
      errors: [{ messageId: "orphanedAbortController" }],
    },
  ],
});
