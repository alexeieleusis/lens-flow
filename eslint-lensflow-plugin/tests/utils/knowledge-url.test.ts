import { describe, expect, it } from "vitest";
import { knowledgeUrl } from "../../src/utils/knowledge-url.js";

describe("knowledgeUrl", () => {
  it("appends the section as a human-readable suffix when given", () => {
    expect(
      knowledgeUrl(
        "catalog/T47-gradual-typing.md",
        "Antipattern A — any to bypass type errors",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/jpablo/vibe-types/" +
        "7891def9e1b66bebd95a393b42f3401eba697cd5/plugin/skills/typescript/" +
        'catalog/T47-gradual-typing.md (see: "Antipattern A — any to bypass type errors")',
    );
  });
});
