import requireExplicitVariance from "./require-explicit-variance.js";
import { knowledgeUrl } from "../utils/knowledge-url.js";

const URL = knowledgeUrl(
  "usecases/UC17-variance.md",
  "Pattern D — Explicit `in`/`out` markers (TypeScript 4.7)",
);

/**
 * @deprecated Use `require-explicit-variance` instead.
 * This rule is functionally equivalent to `require-explicit-variance`.
 * Both rules visit `TSInterfaceDeclaration` and `TSTypeAliasDeclaration`,
 * detect type parameters used in a single variance position, and suggest
 * `in` or `out` annotations. This module re-exports the base rule to
 * maintain backward compatibility. Migrate to `require-explicit-variance`
 * for the canonical implementation.
 */
export default requireExplicitVariance;
