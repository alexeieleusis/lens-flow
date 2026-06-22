#!/usr/bin/env node
/**
 * Migrates existing rule files to use hash-pinned knowledge URLs.
 *
 * Two patterns are handled:
 *   1. `const URL = "https://...refs/heads/main.../typescript/..."` →
 *      `const URL = knowledgeUrl("...")` + import added
 *   2. Inline URL strings with `refs/heads/main` →
 *      replaced with the commit hash in-place
 *
 * Rules that have no URL at all are skipped (fix separately).
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

const HASH = "7891def9e1b66bebd95a393b42f3401eba697cd5";
const OLD_REF = "refs/heads/main";
const VIBE_BASE = "https://raw.githubusercontent.com/jpablo/vibe-types/";
const TYPESCRIPT_SEGMENT = "/plugin/skills/typescript/";

const KNOWLEDGE_URL_IMPORT = `import { knowledgeUrl } from "../utils/knowledge-url.js";\n`;

// Matches both single-line and two-line `const URL = "..."` declarations.
const CONST_URL_RE =
  /const URL =\s*\n?\s*"https:\/\/raw\.githubusercontent\.com\/jpablo\/vibe-types\/refs\/heads\/main\/plugin\/skills\/typescript\/([^"]+)"/g;

function addImport(content) {
  // Find the end of the entire import block, including multi-line imports.
  // Strategy: scan for the last occurrence of a line that closes an import (ends with ";")
  // that is preceded at some point by a line starting with "import".
  const lines = content.split("\n");
  let lastImportEnd = -1;
  let inMultiLine = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inMultiLine && line.startsWith("import ")) {
      if (line.trimEnd().endsWith(";")) {
        lastImportEnd = i;
      } else {
        inMultiLine = true;
      }
    } else if (inMultiLine && line.trimEnd().endsWith(";")) {
      lastImportEnd = i;
      inMultiLine = false;
    }
  }
  if (lastImportEnd === -1) return KNOWLEDGE_URL_IMPORT + content;
  lines.splice(lastImportEnd + 1, 0, KNOWLEDGE_URL_IMPORT.trimEnd());
  return lines.join("\n");
}

async function processFile(filePath) {
  const original = await readFile(filePath, "utf-8");
  let content = original;

  // --- Pattern 1: const URL = "..." → knowledgeUrl("...") ---
  const hasConstUrl = CONST_URL_RE.test(content);
  CONST_URL_RE.lastIndex = 0; // reset after .test()

  if (hasConstUrl) {
    const alreadyImported = content.includes("knowledgeUrl");
    content = content.replace(CONST_URL_RE, (_, path) => `const URL = knowledgeUrl("${path}")`);
    if (!alreadyImported) {
      content = addImport(content);
    }
  }

  // --- Pattern 2: inline refs/heads/main → commit hash ---
  if (content.includes(OLD_REF)) {
    content = content.replaceAll(OLD_REF, HASH);
  }

  if (content !== original) {
    await writeFile(filePath, content, "utf-8");
    return true;
  }
  return false;
}

async function main() {
  const rulesDir = new URL("../src/rules", import.meta.url).pathname;
  const files = (await readdir(rulesDir))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => join(rulesDir, f));

  let changed = 0;
  let skipped = 0;

  for (const file of files) {
    const wasChanged = await processFile(file);
    if (wasChanged) {
      changed++;
      console.log(`  updated  ${file.split("/src/rules/")[1]}`);
    } else {
      skipped++;
    }
  }

  console.log(`\nDone. ${changed} file(s) updated, ${skipped} file(s) unchanged.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
