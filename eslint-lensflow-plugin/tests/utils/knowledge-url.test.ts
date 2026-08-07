import { describe, expect, it } from "vitest";
import { COMMIT, knowledgeUrl } from "../../src/utils/knowledge-url.js";

describe("knowledgeUrl", () => {
  it("appends the section as a human-readable suffix when given", () => {
    expect(
      knowledgeUrl(
        "catalog/T47-gradual-typing.md",
        "Antipattern A — any to bypass type errors",
      ),
    ).toBe(
      `https://raw.githubusercontent.com/jpablo/vibe-types/${COMMIT}/plugin/skills/typescript/` +
        'catalog/T47-gradual-typing.md (see: "Antipattern A — any to bypass type errors")',
    );
  });
});
