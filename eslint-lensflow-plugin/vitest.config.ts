import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html", "json-summary"],
      thresholds: {
        statements: 79,
        branches: 70,
        functions: 89,
        lines: 83,
      },
    },
  },
});
