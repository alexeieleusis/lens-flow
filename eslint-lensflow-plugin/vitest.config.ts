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
        statements: 86,
        branches: 80,
        functions: 90,
        lines: 86,
      },
    },
  },
});
