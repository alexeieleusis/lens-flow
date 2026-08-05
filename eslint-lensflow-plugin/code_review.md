# Code Review Guide — ESLint Lensflow Plugin

Compiled from Copilot review comments. Each section explains the _why_ behind a class of issues, then lists concrete _what to check_ items.

---

## AST Node Coverage

ESLint rules that only handle one form of a construct will silently miss violations in equally valid alternatives. TypeScript and JavaScript provide multiple syntactic ways to express the same semantic idea.

- Check that parameter-checking rules handle all parameter forms: `Identifier`, `AssignmentPattern` (defaults), `RestElement`, and `ArrayPattern` / `ObjectPattern` (destructuring)
- Check that visitor helpers cover all declaration forms for the target construct — e.g., `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, `TSDeclareFunction`, `TSFunctionType`, and `MethodDefinition`
- Check that rules don't early-return on the first unexpected node type without considering whether other node types should also be handled
- Check that type-detection helpers covering specific type references (e.g., `Map`/`Set`) also handle equivalent mutable forms sharing the same AST shape — `checkReferenceType` matching `Map`/`Set` but missing `Array<T>` means `get items(): Array<string>` won't be flagged
- Check that type-name extraction helpers handle `TSQualifiedName` (e.g., `TE.TaskEither`, `fp.Task`) by using the right-side identifier — a `getTypeRefName` that only matches `Identifier` will miss qualified references, producing false negatives for namespaced effect types

## AST Key Matching

In TypeScript type literals, property keys can appear as `Identifier`, `Literal` (string/number), or `ComputedProperty`. Rule logic that only matches `Identifier` keys will miss valid uses of string-literal keys (e.g., `{ "data": ... }`), leading to false positives or incorrect exemptions.

- Check that key-matching logic covers `Identifier` AND `Literal` string keys at minimum
- When a rule exempts or special-cases a property by name, verify the check works for quoted property syntax
- Consider helper functions to extract a property's string name regardless of AST node form
- Check that name extraction for error messages handles `Literal` keys (string and numeric) — a check that only reads `member.key.name` from `Identifier` will report `"unknown"` for `protected "state": number = 0`

## Composite Key Collision Safety

When building a string key from parts of an AST node, unmatched or unhandled node shapes can produce empty or ambiguous segments. For `MemberExpression`, nested objects like `foo.bar.baz` yield an empty `objName` (`.baz`), which collides with other nested expressions sharing the same leaf property.

- Check that key-extraction functions handle all node shapes that can appear in the position they inspect, not just the common case
- Verify that composite keys cannot collide when different AST structures produce the same string
- Reject or explicitly handle empty/partial keys (e.g., `.prop` with no object) rather than allowing silent collisions

## AST Node Path Correctness

Verify the correct property path for each AST node type — `TSESTree.TSEnumDeclaration` exposes members directly on `decl.members`, not `decl.body.members`. Using the wrong path will fail typechecking or throw at runtime, preventing the rule from reporting anything. Consult the `@typescript-eslint/types` definitions or existing rules that visit the same node type.

## AST Traversal Guards

### Avoid Redundant Runtime Checks

When the TypeScript-ESLint types already guarantee a node's structure, adding extra runtime guards (`typeof`, `"prop" in`, existence checks) is unnecessary and obscures intent. For example, a `TSTypeOperator` node's `typeAnnotation` is always a `TypeNode` with a `type` field — checking `node.typeAnnotation && typeof node.typeAnnotation === "object" && "type" in node.typeAnnotation` adds no safety.

- Remove redundant `typeof` / `"key" in` / existence checks when the type system ensures the shape
- Keep conditions focused on the actual decision logic, not defensive boilerplate

### Custom Walker Boundaries

Custom AST walkers must stop at function-boundary nodes (`FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`). Recursing into nested function bodies attributes inner-function constructs to the outer scope, producing false positives. ESLint already visits nested functions separately.

- Check that walkers stop traversal at function boundaries — a type-predicate rule counting `typeof`/`in` checks must not descend into local helpers or callbacks inside the predicate
- Check that walkers searching for type parameter references cover every AST node type where the reference can appear — missing a case in the walker's `switch` produces silent false negatives. For example, a walker must traverse both `objectType` and `indexType` of `TSIndexedAccessType`, and must handle `TSFunctionType`/`TSConstructorType`
- Check that walkers searching for value identifiers skip type-annotation and comment fields — traversing into `typeAnnotation`, `typeArguments`, `returnType`, and comment nodes causes the rule to report on identifiers that appear only in type positions. Expand `SKIP_KEYS` to exclude these fields
- Check that deep recursive walkers use a `WeakSet` visited set to avoid redundant work on large or cyclic AST subtrees

### Prefer `getAncestors()` Over Manual Parent Walks

Walking `node.parent` pointers directly relies on parent pointers being present and enabled by parser configuration. ESLint's `context.sourceCode.getAncestors(node)` is the canonical API — guaranteed to work regardless of parser settings.

- Check that ancestor-walk helpers use `context.sourceCode.getAncestors(node)` instead of manually following `node.parent`
- Avoid casting nodes to `Record<string, unknown>` to access `parent` — this bypasses type safety and depends on non-standard AST fields
- Check that helpers verifying a relationship between a detected call and its declaring variable confirm the call is the direct initializer, not merely somewhere in the ancestor chain. The freeze call (or an immediately wrapping type assertion) must be exactly `declarator.init`
- Check that identifier-search helpers limit their search scope to only the relevant subtree — searching an entire `IfStatement` (including the body) for a variable name extracted from the `test` condition can pick the wrong identifier if the name is reused or shadowed
- Check that parent-walk helpers traversing upward through a call chain unwrap TypeScript wrapper nodes (`TSAsExpression`, `TSNonNullExpression`, `ChainExpression`, `TSSatisfiesExpression`) rather than stopping at the first non-matching type

### Nested Scope Validation

Validation and guard-detection helpers must search the full function body, not just top-level statements. A `body.body.some(stmt => stmt.type === "IfStatement")` check only sees top-level nodes, missing validation inside `for`, `try`, or nested `if` blocks.

- Check that guard-detection helpers (`hasValidation`, `hasThrowStatement`, etc.) use `walkNodes` instead of `body.body.some(...)` to cover nested control structures
- Check that rules distinguishing validated from unvalidated code paths treat nested validation as equivalent to top-level validation

## Code Deduplication & Rule Drift

Maintaining two parallel implementations of the same rule logic increases surface area for bugs and makes it easy for them to diverge — one gains new syntax support or message improvements while the other doesn't.

- Check that substantially duplicate rules share extracted logic (helpers, shared visitors, or base rules) rather than copying implementation
- Consider making a duplicate rule an alias or thin wrapper around the canonical implementation, so behaviour stays consistent over time
- Check that rules reuse shared traversal helpers from `src/utils/ast-helpers.ts` (e.g., `walkNodes`, `hasAssertNever`) rather than reimplementing generic AST walks — rolling a custom walk by enumerating `Object.keys()` on a node misses cycle protection, duplicates logic, and is fragile against future AST changes

## Code Style & Import Consistency

Inconsistent imports and quote style across rules create visual noise in reviews, complicate linting configuration, and can increase runtime bundle size when type-only imports aren't marked as such.

- Check that imports used exclusively in type positions use `import type` — e.g., `import type { TSESTree, TSESLint }` — so the bundler can strip them entirely
- Check that type positions use a named import from a proper `import type` statement rather than inline `import("...")` type references, for readability and consistency
- Check that import quote style (single vs double quotes) matches the existing convention in neighbouring rule files
- Check that indentation within a rule's `meta` object and nested blocks matches the project convention (4-space indent)
- Check that `meta` on non-fixable rules includes `fixable: undefined` — this matches the convention in sibling rules and makes the absence of a fixer explicit
- Check that `typescript` imports use the default import style (`import ts from "typescript"`) consistently — namespace imports (`import * as ts`) are inconsistent with the established convention
- Check that module-level constant names don't shadow built-in globals — a constant named `URL` shadows the global `URL` constructor; use a descriptive name like `KNOWLEDGE_URL`
- Check that boolean-returning helper function names match their return semantics — a name like `checkParamsCompatibility` that returns `true` when an _incompatibility_ is found is inverted; rename to `hasIncompatibleParams` or invert the return value
- Keep helper utility imports in sync with the traversal implementation — remove unused imports when a custom walker replaces a generic utility
- Check that visitor object keys (AST selectors like `"Program:exit"`) are indented consistently with the other keys in the same visitor
- Check that identifier naming follows the same case convention as the surrounding codebase — if existing rules use camelCase, new rules should not use snake_case
- Check that boolean conditions in detection helpers are simplified — `v.type === "Identifier" === false && v.type === "Literal"` is equivalent to `v.type === "Literal"` but far harder to read

## Control Flow & Scope Awareness

Rules that correlate a node with an enclosing control structure by walking ancestors, or scan a function body for a pattern, must respect scope boundaries and match precisely. Walking past a function declaration links code inside a nested callback to an outer function where the variable may be shadowed and the control flow is unrelated. ESLint already visits nested functions separately through its own traversal.

### Function Boundary Enforcement

- Check that ancestor-walk helpers (e.g., `findEnclosingIf`, `findEnclosingSwitch`) stop at function boundaries so casts in nested callbacks aren't attributed to outer control structures
- Check that descendant-walk helpers (e.g., `findJsonParse`, `containsNullishCoalesce`, `findReturnStatements`) stop at function boundaries — scanning the full body of an outer function will match patterns inside nested inner functions, producing false positives
- Check that descendant-walk helpers counting occurrences of a pattern (e.g., `typeof`/`in` checks in a type predicate body) stop at nested function boundaries
- Check that boundary-checking helpers use valid ESTree node type names — `"Function"` does not exist; the correct types are `FunctionDeclaration`, `FunctionExpression`, and `ArrowFunctionExpression`

### Scope Resolution

- Check that rules correlating a cast's base with a test's base compare the full expression, not just the deepest identifier — `(data.payload as any).value` inside `if (data.kind === "A")` casts a different expression than the one checked
- Check that narrowing-correlation rules resolve and compare actual variable bindings from the scope manager, not just identifier names — an inner binding shadowing the narrowed variable's name means the cast is on a different value
- Check that rules tracking parameters by name resolve identifiers via ESLint's scope information, not by raw string comparison — look up the identifier's actual binding and only count it when the binding is the tracked parameter definition
- Check that body-scanning helpers tracking variable usage stop at nested function boundaries and account for parameter shadowing — an outer parameter `x: any` should not be flagged when a nested function redeclares `x`
- Prefer ESLint scope analysis over raw AST identifier traversal when checking whether a parameter or variable is "used" — look up the parameter via `context.getDeclaredVariables()` and check `variable.references.length`

### Discriminant & Property Matching

- Check that discriminant or property-name matching validates against the allowed set before treating a truthy member access as a match — `if (data.x)` should not be treated as a discriminant check when `x` is not in `DISCRIMINANT_NAMES`
- Check that rules claiming to detect discriminant widening restrict checks to discriminant-like property names (e.g., `kind`, `type`, `status`) — treating any string-literal property as a discriminant candidate will flag common shapes like `{ name: "Alice" }`
- Check that helpers extracting identifiers from compound conditions collect all matching bases, not just the first — short-circuiting on the first hit produces false negatives for later branches
- Check that literal-comparison guards in narrowing detection exclude `TemplateLiteral` nodes with substitutions — only templates with zero `expressions` should be treated as literal narrowing

### State Tracking

- Check that rules tracking per-function state with entry/exit visitors use a stack instead of a single scalar — a nested function's exit handler will clear state meant for the outer function. Push on entry, pop on exit
- Check that scope-tracking rules also handle nested classes — tracking state as a single global means a nested `class` inside a method will overwrite the outer class's state. Use per-class scope tracking with push/pop semantics, and distinguish synchronous constructor body from deferred callbacks

### Ancestor Walk Correctness

- Check that ancestor-walk helpers correlating a node with an enclosing method stop at the nearest function/class boundary and verify that function is the method's value via `MethodDefinition`
- Check that ancestor-walk helpers searching for an enclosing `TryStatement` stop at function boundaries. A `.parse()` call inside a nested callback within a `try`/`catch` is not handled by that `try`/`catch` for exceptions that escape from the callback's own invocation
- Check that ancestor-walk helpers for `TryStatement` verify the target node descends from `tryStatement.block`, not merely that `TryStatement` is an ancestor — a call inside the `catch` or `finally` block is not protected by that `try`
- Check that ancestor-walk helpers searching for a narrowing context continue walking past a non-matching narrowing context to find one that matches the casted base

### Control Structure Detection

- Check that guard-detection helpers inspect both the `consequent` and `alternate` branches of `IfStatement` — common guard patterns use `else { throw ... }`
- Check that AST walkers searching for a specific control structure continue traversing after finding a match, rather than returning early
- Check that ESLint selectors targeting a specific control-structure branch do not match nodes inside nested structures of the same kind — walk from the node to its nearest enclosing structural ancestor instead
- Check that helpers determining whether a variable is declared inside a function scan the entire function body recursively, not just top-level `VariableDeclaration` statements
- Check that rules detecting captures into "outer-scope" variables also verify the target object itself is outer-scoped — assigning to a property on a local object is not an outer-scope capture
- Avoid redundant tracking flags when the control flow already guarantees a single report — a `reported` boolean can be replaced with `break` after `context.report()`

## Error Handling & Graceful Degradation

Rules that require TypeScript program info should fail gracefully when `parserOptions.project` isn't configured, rather than crashing the lint run.

- Check that `getParserServices(context)` is called with `true` as the second argument (`allowNoProject`) when the rule should no-op without type info
- Check that `!program` guards actually execute — if `getParserServices` throws before returning, the guard is dead code
- Check all rule creators and visitor factories that depend on `parserServices` for the same pattern
- Check that rules accessing `node.parent` defensively handle the case where `parent` might be missing — use `node.parent ?? node` to avoid a potential crash
- Check that user-supplied strings compiled as `RegExp` are validated before use — an invalid pattern from a rule option will throw during rule initialization and crash ESLint. Wrap `new RegExp(p)` in a try-catch and rethrow with a message that names the offending option and pattern

## Project File Hygiene

Placeholder, duplicate, or unused files expand the TypeScript project surface unnecessarily, confuse tooling, and can appear in published packages.

- Check that placeholder files used for type-aware testing (e.g., referenced by `RuleTester`'s `filename`) live under `tests/`, not at the package root — a root-level `file.ts` adds to the TS project surface and risks accidental inclusion in the published bundle
- Remove duplicate or unused files before merging — keep only the single source of truth
- Remove unused helper functions within rule files — declared but uncalled functions fail under `noUnusedLocals`, add dead code, and make the rule harder to maintain

## Import Dependencies & Runtime Resolution

Utility modules are consumed at runtime by end users' ESLint setups. If a package is imported but not declared as a direct or peer dependency, strict layouts (pnpm, npm hoisting) will fail to resolve it.

- Check that every imported package (`@typescript-eslint/types`, `@typescript-eslint/scope-manager`, `typescript`, etc.) appears in `package.json` as either a `dependency` or `peerDependency`
- Prefer re-exporting `AST_NODE_TYPES` and `TSESTree` from `@typescript-eslint/utils` instead of importing `@typescript-eslint/types` directly, to reduce the dependency surface
- If `typescript` is imported at runtime, declare it as a `peerDependency` — consumers may not have it in `devDependencies` only
- Audit newly added utility files for undeclared imports before merging
- Check that traversal utilities like `eslint-visitor-keys` are declared in `dependencies` when imported directly by a rule — consumers will fail to load the rule under strict package managers if the dependency is missing

## Logic Correctness & Edge Cases

Grouping, matching, name-extraction, and member-counting logic must handle all plausible input shapes: anonymous declarations, computed properties, non-identifier objects, empty results, and the distinction between static and instance members.

### Comparison & Chain Analysis

- Check that comparison-detection rules include all four distinct comparison operators (`===`, `==`, `!=`, `!==`) without duplicates — a duplicated `"!="` entry with a missing `"!=="` means guards like `x !== null` won't be recognized
- Check that chain-analysis rules verify all branches in a detected sequence match the same criteria before reporting — counting matching branches independently and reporting when any member key reaches a threshold produces false positives. The chain segment must be homogeneous with respect to the tracked property
- Check that comparison-extraction helpers distinguishing a discriminant filter from a non-filtering comparison only match when one operand is a `Literal` — `a.type === b.type` where both sides are variable accesses is not a narrowing check

### Grouping & Name Extraction

- Check that overload-grouping logic compares function names, not just proximity — unrelated declarations between an overload and its implementation should not be grouped together
- Check that anonymous `FunctionDeclaration` nodes (e.g., `export default function () {}`) don't produce bogus overload groups when `id` is `undefined`
- Check that name-extraction helpers like `getMemberName` validate their output before it's used as a grouping key — empty strings or `.`-prefixed names should be rejected
- Check that `getComparisonInfo` rejects `MemberExpression` nodes that can't resolve to a stable name (computed members, `this` expressions)
- Check that function-name extraction for error messages uses the function's `id` when available — `FunctionExpression` nodes can have an `id`, and reporting `"anonymous"` instead of `node.id?.name` produces less actionable diagnostics
- Avoid deriving identifiers by splitting source text — this heuristic is fragile; use the AST to walk to the declaring node and read its `id`

### Member Counting & Static vs Instance

- Check that member-counting logic distinguishes `static` from instance members when the rule's message or intent refers specifically to instance state — filtering `PropertyDefinition` alone includes `static` fields
- Check that helpers extracting object-literal property names exclude computed properties (`{ [foo]: 1 }`) — the computed key's runtime value cannot be determined from identifier text
- Check that excess-property or structural-mismatch rules account for index signatures — a target type with `{ [key: string]: unknown }` explicitly allows arbitrary additional properties; add an early return when the target has an index signature

### Parameter Handling

- Check that parameter-name extraction for error messages handles non-Identifier parameters — destructuring, rest, and default params should fall back to `sourceCode.getText(param)` rather than reporting `"?"`
- Check that parameter-type detection accounts for `AssignmentPattern` wrappers around default parameters (`(x: any = 1) => {}`), which insert an extra node in the parent chain
- Check that parameter-type detection recognises destructured parameters where the parameter node is an `ObjectPattern` or `ArrayPattern` rather than `Identifier`, `RestElement`, or `TSParameterProperty`
- Check that type-check helpers operating on raw parameter nodes normalise the parameter before inspection — for `AssignmentPattern` the annotation is on `param.left.typeAnnotation`, and for `TSParameterProperty` it's on `param.parameter.typeAnnotation`. Normalise first, then report on the original node so the underline lands on the full parameter
- Check that parameter-counting rules don't skip an entire function when any parameter is a `TSParameterProperty` — `TSParameterProperty` nodes are still parameters and should count toward the limit
- Check that variable-annotation detection handles typed destructuring declarations (`const { x }: any = value`), where the parent of `TSTypeAnnotation` is an `ObjectPattern` or `ArrayPattern` instead of an `Identifier`

### Type Classification

- Check that type-classification helpers distinguish the specific type shape they're meant to detect from broader categories — a rule targeting union-typed parameters should check for `TSUnionType` syntactically, not treat every non-primitive annotation as a union
- Check that type-checking helpers validate AST node shapes before accessing properties — `isAsConst` should verify `typeName.type === "Identifier"` before reading `typeName.name`
- Check that type-classification helpers don't rely on misleading casts that suggest a guard which doesn't actually exist — e.g., `node as TSArrayType & { readonly?: boolean }` is misleading because `TSArrayType` has no `readonly` property; `readonly T[]` is parsed as a `TSTypeOperator` wrapping a `TSArrayType`. Either remove the cast or handle `TSTypeOperator` explicitly
- Check that helpers detecting the same pattern (e.g., `isAsConst`) use a consistent, correct AST shape across all rules — `as const` produces a `TSTypeReference` with an `Identifier` typeName `const`, not a `TSLiteralType`
- Check that brand-type detection verifies actual brand property markers (`_brand`, `__brand`, `*Brand`) in the intersection, not just the presence of any non-empty type literal — matching `primitive & { ... }` broadly catches non-brand structural intersections

### Type Checker & Assignability

- Check that type-aware rules detecting incompatible intersections use type-argument overlap checks, not whole-type mutual assignability — `Array<1 | 2> & Array<2 | 3>` is not mutually assignable but is satisfiable as `Array<2>`
- Check that type-aware rules performing assignability checks verify the narrowing direction: the target type must be assignable to the source, but not vice-versa. A one-way check will falsely flag broadening casts like `x as any`
- Avoid comparing TypeScript symbols by `escapedName` string equality to determine interface-implementation relationships — this can miss type aliases, fail for inheritance chains, and produce false positives when distinct interfaces share the same name. Prefer the TypeScript checker's assignability APIs

### Type Canonicalization

- Check that type-canonicalization helpers produce unique keys for structurally distinct types — a serializer that only returns the AST node kind collapses all type references into the same key. Include the referenced name, literal value, or nested structure
- Check that type-literal canonicalization includes all member kinds, not just `TSPropertySignature` — dropping `TSMethodSignature`, `TSCallSignatureDeclaration`, `TSConstructSignatureDeclaration`, and `TSIndexSignature` means types differing only in those members collapse to the same key
- Check that type-literal canonicalization includes property modifiers that affect the structural contract — omitting `TSPropertySignature.optional` treats required and optional properties as equivalent
- Check that helpers flattening `TSIntersectionType` members into a linear array preserve the union-member grouping — pushing each `TSTypeLiteral` from an intersection as a separate entry makes downstream index-based logic treat literals from the same union arm as if they belonged to different arms

### Error Message Quality

- Check that `sourceCode.getText` used for error message data targets the type node itself, not the enclosing `TSTypeAnnotation` — `getText(member.value.returnType)` includes the leading colon
- Check that diagnostic messages for type-aware rules provide actionable type names when the type is anonymous — fall back to `sourceCode.getText(typeNode)` instead of the literal string `"unknown"`
- Check that error message `data` interpolations for type names fall back to the source text of the type argument when the type is anonymous — use `sourceCode.getText(innerTypeNode)` as the fallback
- Check that self-reference detectors for type aliases only treat bare `Identifier` references as self-references, not `TSQualifiedName` whose rightmost segment happens to match — `type Foo = Namespace.Foo` is not a circular alias

### Composite Keys & Encoding

- Check that composite grouping keys built from user-authored string values use a collision-free encoding — concatenating with a delimiter like `::` fails when the value itself contains the delimiter. Use `JSON.stringify([prop, value])` or a delimiter that cannot appear in the input

### Rule Options & Thresholds

- Check that configurable rule options actually affect the rule's behaviour — an option that only triggers an early-return in a code path that wouldn't report anyway is a dead branch. Remove unused options or fix the logic path
- Check that rule option defaults survive empty options objects — destructuring like `context.options[0] ?? { maxMembers: 4 }` only guards against `undefined`, not `{}`. Default at the property level with a fallback
- Check that threshold comparisons for configurable limits use the same operator across rules — `>=` vs `>` produce off-by-one differences. If `maxMembers: 5` means "up to 5 is OK", the rule must use `> 5`
- Check that `Set` or array literals used as allow-lists don't contain duplicate entries — duplicates don't break logic but make the list harder to audit and can hide mistakes

### API Call Matching

- Check that helpers matching specific runtime API calls verify the method actually exists on the target object — `Object.setProperty` is not a standard JavaScript API; the correct method is `Object.defineProperties`
- Check that method-name-matching rules scope to the intended receiver type — matching any `.parse()` call produces false positives for `Date.parse()`, `Number.parseInt()`, or custom parsers. Scope to schema-like receivers or use an explicit allow/deny list
- Check that function-name-matching sets for detecting specific API calls target the actual callback-taking function, not a related global object — including `process` will match any user-defined `process(...)` call but miss `process.nextTick(...)`

### Function & Arrow Handling

- Check that rules handling arrow functions account for expression bodies (`node.expression === true`) where `node.body` is an `Expression`, not a `BlockStatement`. Wrapping the expression as `{ type: "BlockStatement", body: node.body }` produces invalid AST shape
- Check that rules detecting functions by a characteristic parameter type also handle `ArrowFunctionExpression` and `FunctionExpression` bound via `VariableDeclarator`
- Check that rules analyzing function bodies guard against `body: null` on `FunctionDeclaration` and `FunctionExpression` — overload signatures and `declare function` have no body, and calling body-analysis helpers unconditionally will crash ESLint
- Check that rules covering functions with expression bodies don't silently skip them — expression-bodied arrows can still have a reachable endpoint, and an early return on non-block bodies creates false negatives

### Guard Conditions & Reachability

- Check that parent-shape matching in a rule only includes parent types that semantically represent the violation — a "capability probe" rule checking for `(x as any).property` should only fire when the cast is the object of a `MemberExpression`, not in `IfStatement` test or `LogicalExpression` operand
- Check that rules which enable behavior based on one parameter's type only track that parameter's name, not all parameter names — `function f(s: Shape, n: number) { return n as any; }` should not report the cast on `n` just because `s` has a union type
- Check that guard conditions actually match the AST shape at the point they're evaluated — walk the actual parent chain to verify reachability
- Check that early-return guards on expression shape don't make later guards unreachable — if a visitor returns early when `node.init` is not an `ObjectExpression`, any subsequent check for `TSSatisfiesExpression` on `node.init.parent` is dead code
- Check that guard conditions on a node's `parent` actually match the AST shape at that point in the tree — e.g., checking `init.parent?.type === "LogicalExpression"` on a `ChainExpression` that is the `init` of a `VariableDeclarator` will never match because `init.parent` is the `VariableDeclarator` itself

### Traversal & Iteration Safety

- Check that graph or chain traversals (e.g., walking superclass inheritance) include cycle detection — track visited nodes in a `Set` and break when a cycle is detected
- Check that iterations over heterogeneous node arrays use a safe predicate instead of casting the entire array — use `find` with a type guard, e.g., `n.type === "ClassDeclaration" && n.id?.name === X`
- Check that depth or nesting computation treats `SpreadElement` consistently across `ObjectExpression` and `ArrayExpression`
- Check that helpers scanning an array of statements (e.g., `SwitchCase.consequent`) recurse into `BlockStatement` children — a throw inside `default: { throw ... }` won't be caught by a loop that only inspects top-level statements
- Check that pattern-detection helpers recursing through a node tree cover all statement forms where the target pattern can appear, not just `BlockStatement`

### Reporting & Attribution

- Check that rules visiting `VariableDeclaration` with multiple declarators iterate each declarator individually and report per-violation — reporting once per statement with the first declarator's name produces wrong counts
- Check that `context.report` targets the most specific node possible (e.g., the individual `Identifier` or `VariableDeclarator`) rather than the enclosing `VariableDeclaration` — reporting on the whole statement underlines unrelated declarators
- Check that rules reporting on a declaration's properties or members attribute the violation to the correct declaration — walking ancestors past intermediate type nodes will misattribute a nested inline type literal's properties to its enclosing interface
- Check that rules collecting multiple violations from a single parent node report each violation on its specific source node, not on the enclosing container
- Check that nested-checking functions don't produce duplicate reports for the same violation — either have the caller skip sub-checks the helpers already perform, or track already-reported nodes

### Termination Analysis

- Check that termination analysis for `SwitchStatement` evaluates per-case termination correctly — requiring every statement in a case to be terminating is wrong: a case like `case 0: console.log(...); throw ...` has a terminating last statement. Evaluate from the last consequent statement, with fallthrough inheriting from the next case
- Check that termination analysis for infinite loops scans the loop body for `break` and `return` statements — treating the loop header as sufficient produces false negatives when the body can exit
- Check that termination analysis for functions annotated `never` considers every code path, not just the last top-level statement — use ESLint's code-path analysis or a proper control-flow walker

### Variable Tracking

- Check that rules tracking a variable by its initializer also account for later reassignments — a `let` binding initialized from one expression may be reassigned before the point of use. Either restrict the check to immutable declarations (`const`) or track write references
- Check that validation or guard-detection helpers verify the control structure actually enforces a type guard, not just that a control structure exists — `hasValidation` treating any preceding `IfStatement` as validation means `if (debug) log(); return obj as any;` would bypass the rule

### Expression Pattern Detection

- Check that expression-pattern-detection helpers cover every AST node form where the pattern can appear — a helper checking for `MemberExpression` or `Identifier` will miss `ChainExpression` (optional chaining), which wraps the underlying expression
- Check that ignore-pattern or name-matching helpers unwrap wrapper AST nodes (e.g., `ChainExtension`) so that configuration applied to the underlying identifier still applies
- Check that node-identity comparisons unwrap wrapper expressions before comparing — normalize both sides through common wrappers (`TSAsExpression`, `TSNonNullExpression`, `ChainExpression`, `TSSatisfiesExpression`)

### Helper & Code Quality

- Check that declared helper functions are actually called — unused helpers add dead code; if a standalone predicate exists alongside separate `check*` helpers that duplicate its logic, either remove the unused function or refactor to call it
- Check that inline comments describing a detection branch match what the code actually does — a comment claiming to "unwrap" a `TSAsExpression` when the code returns early instead is misleading
- Check that rules correlating declarations with usage sites use a two-pass approach — collecting in one visitor and reporting in the same traversal order means declarations appearing later in the file won't be found. Either defer reporting to `Program:exit` or do an initial scan of `Program.body`
- Check that ancestor-walk helpers searching for a condition have a code path that returns `true`, not just `break` — a `while` loop over ancestors that only `break`s on boundaries and then falls through to `return false` will never recognise a match
- Check that type-guard rules track the target parameter's name in their analysis context so that operator checks can verify the operand is actually the guarded parameter
- Check that parameter-compatibility checks for overload implementations handle arity differences correctly — compare only overlapping indices, and treat missing/extra parameters as non-issues unless they make the implementation _less_ permissive
- Check that nullable-type checks in narrowing-correlation rules validate the specific compared value against the variable's actual type constituents — checking whether a type contains _either_ `null` or `undefined` is insufficient when the guard is a strict check. For `string | null` with `!== undefined`, the guard doesn't narrow anything
- Check that visitor branches performing an early-return based on node type don't make the corresponding visitor dead code — e.g., a `TSParameterProperty` visitor calling a helper that returns unconditionally for `TSParameterProperty` before any `context.report()` means the visitor can never produce a diagnostic
- Check that diagnostic messages match the rule's actual enforcement — a message claiming "call another never-returning function" as acceptable is misleading if the implementation doesn't recognise function calls as terminating
- Check that `Program:exit` handlers that aggregate results avoid O(n²) patterns — compute counts once with a `Map` and report in a second pass
- Check that nesting-depth or metric-computation helpers unwrap transparent AST wrappers like `TSParenthesizedType` — a parenthesized type has the same structural complexity as its inner type
- Check that threshold-reporting rules count the entity described in the message, not sub-entities — e.g., a rule reporting "Found N functions with bare-string ID parameters" must count distinct functions, not individual parameters
- Avoid redundant conditions that are subsumed by an earlier check — `name.startsWith("_") || name.startsWith("__")` is redundant because any string starting with `__` also starts with `_`
- Check that body-scanning helpers detecting async/failure patterns handle arrow function expression bodies — `isSyncBody` returning `true` for non-`BlockStatement` bodies means an IIFE that throws inside an expression body is silently ignored

## Plugin Registration & Rule Export

A newly implemented rule is useless to consumers if it isn't wired into the plugin's public entry point. The published package exposes `dist/index.js`, which reads from `src/index.ts`. If a rule file exists with tests but isn't imported and added to the `rules` map in `src/index.ts`, users cannot enable it.

- Check that every new rule is imported and registered in the `rules` object exported by `src/index.ts`
- Check that `src/index.ts` does not export `rules: {}` as a placeholder after rules have been implemented
- If the plugin provides recommended/strict configs, verify the new rule appears in the appropriate config when applicable
- Treat rule registration as part of the rule's definition PR — do not defer it to a follow-up
- Check that a new rule isn't a functional duplicate of an existing rule — same AST selector and reporting behavior means the rules will confuse users and double maintenance. If two rules detect the same violation, consolidate into one with an alias and clear deprecation strategy. When a new rule is a UC-specific variant, extract shared detection logic into a reusable helper

## Regex & Pattern Correctness

Rules that match property names or identifiers via regex must use correct patterns. A subtle typo in a regex can cause the rule to match unintended names while missing the intended ones, and tests written against the broken pattern will silently pass.

- Verify regex patterns against the intended match set before merging — e.g., `subs?ubs?` matches `subub`/`sububs` but not `sub`/`subs`; the likely intent was `subs?`
- When a test case relies on a misspelled property name to exercise a rule, fix the rule's pattern first and update the test to use the correct name
- Check that regex patterns matching function or identifier names are case-sensitive — TypeScript identifiers are case-sensitive, so `/^assertNever$/i` will incorrectly match `assertnever` or `ASSERTNEVER`
- Group regex alternatives explicitly — `/^(internal|_)/i` makes the intent clear and is safer to modify than `/^internal|^_/i`
- Normalize whitespace in comment text before regex matching — `getCommentsBefore` preserves newlines inside block/JSDoc comments, but patterns like `must.*?(?:be|one of)` won't match across newlines
- Check that name-matching regex patterns don't use a case-insensitive flag when the intent is to match conventional suffixes — `/^(id|.*Id)$/i` matches `grid` and `liquid`; the correct pattern should match exact lowercase `id` or the `Id`/`ID` suffix without `i`

## Rule Documentation & Message Accuracy

A rule's `meta.docs.description` and `messages` must accurately reflect what the implementation detects. When the description or messages lag behind the implementation, users receive misleading guidance and may misconfigure or distrust the rule.

### Description-Implementation Alignment

- Check that the rule description covers all violation types the implementation flags — if the rule reports plain `any`, `any[]`, and tuples containing `any`, the description should say so, not only `any[]`
- Check that the description's claimed scope matches what the implementation actually verifies — a description that narrows the scope beyond what the code checks creates a false sense of precision
- Check that the description doesn't claim the rule can make semantic judgments it cannot evaluate at static-analysis time — "when a more specific type is known" implies intent-awareness the rule doesn't have. Phrase descriptions in terms of what the rule actually checks
- Check that the description's stated threshold matches the implementation's default — e.g., "more than 3 levels" when the code allows 4 is misleading. Mention when a limit is configurable via a rule option
- Check that the description's claimed requirement (e.g., "discriminated union members") is actually enforced in code — if the implementation reports on any union of type literals without verifying a discriminant exists, widen the description
- Check that the description clarifies the rule's scope when the implementation only inspects a subset of possible locations — e.g., if the rule only checks function-like return type annotations but not arbitrary type aliases, the description should reflect that narrow scope
- Check that the description's claimed scope matches the granularity of what the implementation reports — "in the same file" when the rule only flags a single class with mixed decorators misleads users
- Check that the description's claimed scope (e.g., "public fields", "empty/null defaults") matches what the implementation actually filters — if the rule doesn't exclude `private`/`protected` fields, the description should not claim to target only public fields
- Check that the description covers all AST node types the implementation visits — if the rule visits both `TSInterfaceBody` and `TSTypeLiteral` but the description only mentions "interfaces", users won't know it applies to inline type literals
- Keep `meta.docs.description` in sync when the implementation is extended to detect additional patterns
- Check that descriptions and messages don't use terms like "recursive" when the implementation only measures nesting depth without detecting self-references — use "deeply nested" or "deeply chained" instead

### Error Message Accuracy

- Check that error messages mention all equivalent type forms the rule detects — if the rule flags both `Result<T, never>` and `Either<never, T>`, the message should not hard-code only one form. Same for `Array<any>` / `ReadonlyArray<any>` alongside `any[]`
- Check that rules claiming an intersection "produces `never`" distinguish between the whole type collapsing to `never` and only certain type arguments collapsing — `Array<string> & Array<number>` has an element type that resolves to `never`, but the intersection type itself may still be inhabited by `[]`
- Check that dynamic placeholders in error messages reflect the actual value the visitor resolves — if the visitor falls back to `"void"` when there's no explicit return type annotation, but TypeScript defaults unannotated signatures to `any`, the message will show an incorrect type. Remove the dynamic value or use a static placeholder
- Check that `sourceCode.getText` for error message data targets the type node itself, not the enclosing `TSTypeAnnotation` — `getText(member.value.returnType)` includes the leading colon; use `getText(member.value.returnType.typeAnnotation)` or the resolved type node directly
- Check that suggested replacements in error messages are syntactically correct for all element types — `readonly {{elem}}[]` is wrong for union element types; wrap `{{elem}}` in parentheses
- Check that type-name extraction for error messages covers primitive keyword types (`TSStringKeyword`, `TSNumberKeyword`, `TSBooleanKeyword`, etc.), not just `TSTypeReference` — otherwise a double assertion like `value as unknown as string` produces an inaccurate message showing `as ?`
- Check that error message formatting covers every literal type variant the implementation supports — if `extractLiteralValue` handles both `Literal` and `TemplateLiteral`, `reportDuplicate` must also render both
- Check that error messages using "(max: X)" accurately reflect the comparison — if the message says `(max: 5)` but the rule reports at `count >= 5`, unions of exactly 5 members are flagged, contradicting "max". Use `> maxMembers` with `(max: X)`
- Check that error messages deriving a name from the declarator's ID handle non-Identifier patterns — falling back to `"(unnamed)"` for destructuring patterns is misleading; use `context.getSourceCode().getText(declarator.id)` instead
- Check that dynamic message data values accurately reflect what the implementation computes — if the message interpolates `{{depth}}` but the rule reports `maxDepth` (the configured threshold), the message presents a threshold as an exact depth
- Check that error messages with dynamic property names interpolate the placeholder consistently throughout the message — hard-coding `#name` instead of `#{{name}}` in one place makes the guidance unactionable
- Check that code snippets in error messages use dynamic placeholders for identifiers rather than hard-coded names — writing `"prop" in value` assumes the parameter is named `value`

### Message Precision

- Check that messages and descriptions are accurate across all TypeScript inference behaviors the rule covers — if a rule flags both `const x = []` (infers `never[]`) and `let x = []` (infers `any[]`), wording the message as "is inferred as `never[]`" is incorrect for the `let`/`var` cases. Use "can be inferred as" or distinguish the declaration kind
- Check that descriptions and messages naming a specific comment format (e.g., "JSDoc") match what the implementation actually inspects — a rule that uses `getCommentsBefore` catches all leading comments including `//` line comments, so "JSDoc comments" misleads users
- Check that variance-related descriptions use precise position terminology — "return position" is narrower than "output position"; a property type (`result: T`) is an output position but not a return type
- Check that error messages and descriptions for operator-based rules avoid absolute runtime claims like "always true" — a property that exists on all union members makes the check unable to narrow, but may still be useful at runtime. Phrase messages around the narrowing/discrimination failure
- Check that inline comments describing a detection branch match what the code actually checks — a comment claiming the branch matches a `TSPropertySignature` with a `TSLiteralType` value when the code only checks `member.computed === true` means the rule is broader than documented

### Terminology

- Don't conflate `any` and `unknown` in descriptions — they have opposite semantics in TypeScript. `unknown` is the safe counterpart to `any`
- Check that code examples in error messages are syntactically correct and compilable — `{{name}} = {}` is missing the `type` keyword and should read `type {{name}} = {}`
- Check that descriptions scoped to a specific usage pattern (e.g., "phantom or state types") either verify that pattern is actually present in the code, or are broadened to match what the implementation reports
- Check that descriptions and messages don't use terms like "recursive" when the implementation only measures nesting depth without detecting self-references
- Proofread rule descriptions for grammar and format compiler flags/CLI options as inline code
- Proofread relative clauses for missing relative pronouns and verbs — "which creates overloaded signatures rarely intended" reads ungrammatical; add "that are"

### Metadata Consistency

- Check that `meta.fixable` is explicitly set when a rule has no fixer — set `fixable: undefined` to match the convention used by other rules in the plugin
- Check that every rule's `meta` shape matches the convention used by other rules in the plugin — missing fields make the meta shape inconsistent and can confuse tooling
- Check that help URLs in rules use stable permalinks (e.g., commit SHA-based URLs or canonical docs pages) rather than branch-head references (`refs/heads/main`)

## Rule Options Handling

### Use Type-Safe Option Defaults with `defaultOptions`

Accessing `context.options[0] ?? {}` is not type-safe under `strict` — the empty object literal doesn't satisfy the declared option type, and subsequent property access may compile or runtime-fail. The correct approach is to declare the option properties as optional in the option type and rely on `defaultOptions` in the rule meta to provide the actual defaults:

```ts
create(context: TSESLint.RuleContext<"msg", [{ maxFields?: number }]>) {
  const { maxFields = 6 } = context.options[0];
}
```

- Check that option types reflect optionality matching the JSON schema
- Use `defaultOptions` to supply defaults, not runtime nullish coalescing with `?? {}`
- Prefer destructured defaults over chained fallbacks for each option field

### Guard Against Empty Option Objects

When the schema permits an empty options object (`{}`), a `??` fallback on `context.options[0]` only triggers when the entire options entry is `undefined`. A config like `[{}`]`passes an object through, so destructuring yields`undefined`for any missing property, leaving numeric comparisons against`NaN`. Always pair the `??` guard with destructured per-field defaults:

```ts
// Safe — covers both context.options[0] being undefined and being {}
const { maxMembers = 20 } = context.options[0] ?? {};
```

- Check that `??` fallbacks on `context.options[N]` are paired with per-property destructured defaults
- Verify the rule behaves correctly when the user supplies an empty object `{}` instead of omitting the option entirely
- Ensure numeric or boolean options never end up `undefined` in a code path that uses them in comparisons
- Check that array-level destructuring defaults (`const [{ opt } = { opt: 3 }] = context.options ?? ...`) don't mask empty-object configs — `[{ opt } = default]` only applies `default` when `context.options[0]` is `undefined`, not when it is `{}`. Use per-property defaults: `const { opt = 3 } = context.options[0] ?? {}`

### Threshold Consistency

- Check that threshold option names match their comparison semantics — an option named `maxTypeParams` with a `>=` check means "max 2 allowed" when set to 3, which is off-by-one relative to the name. Either change the comparison to `>` so the option truly represents the maximum, or rename the option
- Check that error message data fields reflect the actual enforcement boundary — a message rendering `max: {{max}}` with the same value as the threshold used in a `>=` comparison produces a self-contradictory report (e.g., "has 4 members (max: 4)" when 4 is flagged). Report `threshold - 1` as `max`, or switch to `>`
- Ensure threshold comparisons and error messages are consistent across sibling rules that share option names — if `no-excessive-intersection-chain` uses `>` with `maxMembers` and `no-over-intersection` uses `>=` with the same option, users configuring both will receive contradictory diagnostics

## Script & Tooling Correctness

Automation scripts (`stack.py`, CI helpers, importers) operate on external systems (git, GitHub CLI). Small syntax or flag mistakes silently break workflows.

- Check that `git branch --list` is not used for exact branch-name existence checks — it treats the argument as a glob pattern. Use `git rev-parse --verify refs/heads/<name>` instead, and check the exit code
- Check that `gh pr create --reviewer` values are bare logins (e.g., `copilot`), not prefixed with `@`
- Check that subprocess calls inspect return codes, not just stdout content
- Verify that all referenced functions actually exist before merging — a call to an undefined function like `_infer_options_type()` will raise a `NameError` at runtime and break the automation pipeline

## Test Coverage Alignment

Tests that only cover the happy path give false confidence. If the implementation doesn't handle certain node forms or type patterns, the tests should expose that gap — either by failing (if it's a bug) or by being added (if it's missing).

### Node Form Coverage

- Check that invalid test cases cover every node form the rule is supposed to handle, not just the simplest case
- Check that if other rules in the same repo test certain constructs (e.g., `declare function`, `TSFunctionType`), this rule's tests also cover those constructs when semantically relevant
- Check that tests include union-wrapped types, defaulted parameters, and rest parameters where the rule's scope includes them
- Check that a rule variant duplicating an existing rule's tests also includes cases specific to the variant's extra behaviour — a near-copy test suite won't catch regressions in branches unique to the variant (e.g., `TSParameterProperty` handling, non-Identifier parameters)

### Type-Aware Test Cases

- Check that tests for rules inspecting type members via `ts.Type#getProperties()` include class types — class fields produce `PropertyDeclaration` declarations (not `PropertySignature`), and omitting a class case leaves a regression hole
- Check that tests for rules inspecting function return types include callable interface signatures (`TSCallSignatureDeclaration`) — `interface Api { (): Promise<Promise<T>> }` exposes visitor coverage gaps
- Check that tests for narrowing-correlation rules use guard semantics consistent with the variable's declared type — a test with `if (value !== undefined)` on a `string | null` variable doesn't actually narrow the type
- Check that tests for nested-type-detection rules include effects nested under intermediate non-effect generics (e.g., `Promise<Array<Promise<T>>>`) — without this case, a regression in the recursive detection logic won't be caught
- Check that tests for type-name-detection rules include qualified type references (`TSQualifiedName`, e.g., `TE.TaskEither`) — without these, a regression in the `getTypeRefName` helper won't be caught
- Check that tests for type-pattern-detection rules include a regression case for near-miss patterns that should NOT match — e.g., if a rule detects `Partial<T>`, include a valid test with `Foo | undefined` to protect against false positives
- Check that tests for type-pattern-detection rules cover all syntactic forms of the target type — if a rule detects mutable arrays via `TSArrayType` (`T[]`), the tests must also include `TSTypeReference` to `Array` (`Array<T>`)
- Check that tests for type-complexity rules cover parenthesized constraint forms (`T extends ({...} & {...})`) — without these, a gap in the visitor's handling of `TSParenthesizedType` won't be caught
- Check that tests for rules filtering by type annotation include inferred-type cases (e.g., `protected state = 0`) — if the rule's scope includes inferred primitive types, the tests must cover properties without explicit annotations

### Guard & Validation Test Cases

- Check that tests for guard-detection rules cover throws in the `else` branch of `IfStatement` — common guard patterns use `else { throw ... }`
- Check that tests for guard-detection logic include cases where a non-null assertion (`!`) follows a prior null-guard — e.g., `if (x === null) return; x = x!.toUpperCase();`
- Check that tests for guard-detection rules cover validation inside nested blocks (e.g., `if`/`throw` inside `for`, `try`, or inner `if`) — the rule should treat nested validation as valid

### Scope-Sensitive Test Cases

- Check that tests for scope-sensitive rules include a regression test for identifier shadowing — a nested function parameter with the same name as the outer callback parameter should not trigger the rule
- Check that tests for scope-sensitive rules include a regression test for variable shadowing in cleanup detection — a nested scope that redeclares the same variable name and performs the tracked operation should not silence the rule for the outer binding
- Check that tests for scope-sensitive class rules include regression cases for nested classes, deferred callbacks in constructors, and readonly parameter properties — a nested `class` inside a method mutating an outer readonly field should be reported; a mutation inside a callback defined in the constructor should still be flagged as outside the constructor

### Nested Function & Class Test Cases

- Check that tests for type-guard rules include a regression case with a nested function inside the guard — a nested arrow or function expression whose `:exit` could clear the outer type-guard context
- Check that tests for class-hierarchy rules include an abstract base class method case — a base with `abstract method(): this` produces a `TSAbstractMethodDefinition`
- Check that tests for class-member-inspecting rules include methods implemented as class-field arrow functions (`PropertyDefinition` with `ArrowFunctionExpression` value) — e.g., `sort = (nums) => { this.buffer.push(...nums); }`

### Termination & Function Body Test Cases

- Check that tests for termination-analysis rules cover switch cases with multiple consequent statements, fallthrough between cases, expression-bodied arrows annotated `: never`, and `while(true)`/`for(;;)` loops containing `break` — these are common false-positive/false-negative vectors
- Check that tests for rules analyzing function bodies include an overload signature case (`function f(...): T;`) where `FunctionDeclaration.body` is `null` — this prevents regressions that crash the rule on signature-only declarations

### Pattern Detection Test Cases

- Check that tests for rules detecting expression-based patterns include cases with `ChainExpression` (optional chaining) — `props.label?.length || 0` has a `ChainExpression` as its left operand
- Check that tests for rules relying on parent traversal to detect enclosing call sites include cases where the target call is wrapped in TypeScript wrapper expressions (`TSAsExpression`, `TSNonNullExpression`, `ChainExpression`) — a wrapped extraction mid-pipeline should still be reported
- Check that tests for name-suffix or pattern-matching rules include cases where both operands match the pattern — e.g., `StatusUpper` and `StatusConst` both carry a case-related suffix
- Check that tests for name-matching rules include regression cases for words that coincidentally end with the target suffix — `grid` and `liquid` end with `id` but are not IDs

### Declarator & Variable Test Cases

- Check that tests for declarator-based rules cover `let`/`var` declarations, destructured declarators, and class/object property assignments — omitting these leaves the rule's intended scope undefined
- Check that tests for rules correlating a call with its variable declarator cover wrapped or nested call sites (`const x = wrap(Object.freeze(...));`) — these expose parent-walking issues

### Threshold & Configurable Option Test Cases

- Check that test suites cover configurable rule option behavior — if a rule exposes a threshold option, include valid cases that raise the threshold to avoid reports, and invalid cases that test detection heuristics (e.g., non-brand intersections that shouldn't count)
- Check that tests for threshold-reporting rules include a regression case where a single function has multiple violating parameters — the rule should still only count one function

### Duplicate Report Prevention

- Check that tests for rules with nested sub-checkers include a case verifying no duplicate reports — an intersection bound containing a deeply nested type literal should produce exactly one `deepNesting` report

### Test Fixture Correctness

- Check that type-aware test files running as ESM define `__dirname` from `import.meta.url` using `fileURLToPath` rather than relying on the CommonJS global
- Check that valid test fixtures contain syntactically valid TypeScript — `infer` outside a conditional type is a parse error under `@typescript-eslint/parser`
- Check that test case code is syntactically valid for the configured `sourceType` — a bare `return` statement at the top level will fail to parse when `sourceType: "module"`
- Check that test comments accurately describe the number of levels or members in the fixture — a comment saying "Five levels" for a type with 4 nested conditionals misleads future readers

## Type Checker API Usage

Detecting TypeScript types by inspecting AST nodes or checking for property names is unreliable — it produces false positives and can't distinguish between similar types (e.g., `string` has a `length` property, `ReadonlyArray` vs `Array`). The TypeScript compiler's `TypeChecker` provides authoritative, semantic type checks.

- Check that rules with access to a TS `Program` use `TypeChecker.isArrayType()` / `isTupleType()` / `isTypeFlag()` instead of checking for the presence of properties like `length`, `push`, `pop`
- Check that `getParserServices(context)` is used to obtain the `Program` and `TypeChecker`, and that the checker is wired through to all helper functions that need it
- Check that helper function signature changes (e.g., adding a `TypeChecker` parameter) are propagated to every call site
- Check that results from `esTreeNodeToTSNodeMap.get()` are guarded before passing to `checker.getTypeAtLocation()` — the map's `get()` can return `undefined` for certain nodes, and passing `undefined` to the checker will throw at runtime
- Prefer `parserServices.getTypeAtLocation(estreeNode)` directly over a manual `esTreeNodeToTSNodeMap.get()` lookup followed by a `ts.Declaration` cast — the parser services shortcut is simpler, avoids an unnecessary cast, and reduces the chance of type errors

## Type Annotation Wrappers

A type can be wrapped in unions, intersections, or parenthesized types, hiding the inner type from shallow checks. A rule that only inspects the top-level annotation node will miss violations inside wrappers.

- Check that rules detecting specific types (e.g., mutable arrays) unwrap `TSUnionType`, `TSIntersectionType`, and `TSParenthesizedType` to inspect inner types recursively
- Check that type detection functions are recursive over wrapper nodes rather than checking only the direct annotation
- Check that type-pattern-detection helpers also unwrap `TSParenthesizedType` — parenthesized unions like `({ A } | null)` wrap the inner `TSUnionType` in a `TSParenthesizedType`, and shallow checks for `TSUnionType` alone will miss these
- Check that property-key matching in type literals handles both `Identifier` and `Literal` (string) key forms — a `hasKindProperty` check that only matches `member.key.type === "Identifier"` will miss `"kind"` written as a string-literal key
- Check that nested-type detection recurses through intermediate non-effect generic wrappers — e.g., `Promise<Array<Promise<T>>>` has an effect nested under `Array`, and a detection function that only checks direct type arguments will miss this case. The recursion must search all type argument branches
- Check that type-detection helpers match the specific type pattern they're named after, not a broader category — a function checking for `Partial<...>` parameters should only match `TSTypeReference` nodes whose `typeName` is `"Partial"`, not any union containing `TSUndefinedKeyword`. Treating `Foo | undefined` as equivalent to `Partial<Foo>` produces false positives
- Check that type-pattern-detection helpers cover equivalent syntactic forms of the same type — a mutable-array detector that matches `TSArrayType` (`string[]`) must also recognise `TSTypeReference` to `Array` (`Array<string>`), and the check must recurse into union members that contain either form

## Type Safety in Helper Signatures

Using `unknown` or `any` in function parameters defeats TypeScript's purpose and makes refactoring error-prone. ESLint and `@typescript-eslint` provide precise node types that should be used.

### Parameter & Return Types

- Check that parameter arrays are typed as their actual type (`TSESTree.Parameter[]`), not `readonly unknown[]`
- Check that return types from helpers are specific enough that callers can't misuse them
- Check that helper return-type contracts match what the function actually returns for all input shapes — e.g., `getTypedParam` claiming to return `identifier: TSESTree.Identifier` but force-casting non-identifier parameters makes the contract incorrect and can cause runtime issues. Either return only the fields callers actually need, or widen the return type
- Check that casts from ESTree nodes to TypeScript AST nodes use the widest reasonable type — hard-casting to a specific subtype like `ts.FunctionDeclaration` will crash or misbehave when the node is actually a `ts.MethodDeclaration`. Use the base type (`ts.Node` or a shared signature base)
- Avoid narrowing a union-typed parameter to a single specific subtype (e.g., casting to `ArrowFunctionExpression`) just to access a property all members share — type the helper parameter as a generic shape with an optional `returnType` or use a discriminated union

### Type Predicates

- Check that type-predicate helpers use properly typed parameters and meaningful return type predicates instead of `node: any` with `node is any`, which provides no type safety
- Check that type-predicate guards verify every property they narrow in the return type — a predicate claiming `member.key` is an `Identifier` must also check `member.key.type === "Identifier"` in the implementation, not just the outer node's `type`

### Avoid `any` and `unknown` in Helpers

- Check that `as any` casts are not used when TypeScript's narrowing already provides the correct type (e.g., `p.left as any` after `p.left.type === "Identifier"`)
- Avoid duck-typed object literal parameter types (e.g., `{ returnType?: { typeAnnotation?: { type?: string } } }`) when a proper `TSESTree` node type exists
- Avoid inline `any` casts in callback parameters (e.g., `.some((p: any) => ...)`) — these erase the type of `p` entirely and hide missing properties until runtime
- Avoid helper functions that accept `unknown` parameters and immediately cast with `as any` — use a type guard or a properly narrowed parameter type instead
- Avoid custom AST walkers that accept `any` for node, parameter, and return types throughout — the entire helper chain is untyped, defeating any type safety at the call site. Use `TSESTree.Node` and proper parameter types even for internal helpers
- Avoid ancestor traversals typed as `unknown` with repeated `as { type: string }` / `as { parent?: unknown }` casts — `node.parent` is already typed as `TSESTree.Node | undefined` by `@typescript-eslint/utils`
- Avoid pervasive `unknown` / `Record<string, unknown>` casting for AST node access when properly typed `TSESTree` types are available — helpers like `isLiteralType(node: unknown)`, `findTypeParamNames(node: unknown)`, `isTypeRefToParam(node: unknown)` that cast through `unknown` chains are brittle and entirely unnecessary when the callback already receives correctly typed nodes

### Context & Collection Types

- Check that collection types like `Set` used for tracking AST nodes are explicitly typed (e.g., `Set<TSESTree.TSNonNullExpression>`), not left as an untyped `Set`
- Check that reporting helpers accepting `context` use `TSESLint.RuleContext` rather than `any` — the precise type catches invalid `messageId`/`data` usage at compile time
- Check that helper functions accepting `context` derive their `RuleContext` type from the rule's `create()` signature (e.g., `Parameters<ReturnType<typeof createRule>["create"]>[0]`) rather than the generic `RuleContext<string, unknown[]>` — the generic form loses the rule's specific `messageId` typing

### Array Operations

- Check that `Array.find` results are compatible with the callee's expected parameter type — `find` without a type-guard predicate returns `T | undefined`, but if the predicate maps to `T | null | undefined`, the result includes `null`. Either use a type-guard predicate or explicitly handle the `null` case
- Check that `Array.filter` calls on heterogeneous node arrays use a type-predicate callback so the result is properly narrowed — a `filter(member => member.type === "TSTypeReference")` leaves the result typed as the broader `TypeNode[]`, and subsequent property access like `m.typeName` fails under `strict`. Write the callback as a type predicate
- Check that rule option defaults use `context.options[0] ?? {}` with an option type that actually accepts `{}` — under `strict`, `{}` doesn't satisfy a non-empty interface type. Either make option properties optional in the type, or use defaulted destructuring against `context.options[0] ?? {}` typed as `Partial<Options>`

## TypeScript Checker Usage

Rules that rely on the TypeScript type checker (`ts.TypeChecker`) must use the correct APIs for the semantic relationship they're testing. The checker's assignability, compatibility, and subtype predicates have different meanings, and using the wrong one produces both false positives and false negatives.

- Check that intersection-compatibility helpers test for type-argument overlap, not mutual assignability — two types that are not assignable to each other can still have overlapping type arguments (e.g., `Array<1 | 2>` and `Array<2 | 3>` overlap at `2`), and treating non-assignability as incompatibility produces false positives
- Check that diagnostics claiming a type resolves to `never` are precise about which level collapses — the element type of `Array<string> & Array<number>` resolves to `never`, but the overall intersection type may still be inhabited (e.g., `[]` satisfies both)
- Check that type-checker-based rules handle cases where the checker's result differs from the AST-level pattern — e.g., the AST shows `TSIntersectionType` with incompatible type arguments, but the checker may resolve the intersection to a type that's still usable. The rule should report based on checker results, not AST shape alone
- Check that type-classification helpers using the TypeScript checker recurse through both union and intersection constituents — a helper like `typeContainsInterface` that only checks top-level unions misses interfaces nested inside intersections, producing false negatives
- Check that type-aware union classification doesn't gate behaviour on the AST node shape alone — a union member written as a type alias produces a `TSTypeReference` at the AST level, not a `TSTypeLiteral`, so a check like `member.type === "TSTypeLiteral"` will silently skip referenced object types. Use the TypeScript checker's resolved type, not the ESTree node type
- Check that literal-discriminant detection covers all literal type flags — boolean-literal discriminants (`{ kind: true }`) are valid discriminants, so helpers checking `ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral` must also include `ts.TypeFlags.BooleanLiteral`
- Check that type-classification helpers use the TypeScript checker's dedicated APIs (e.g., `TypeChecker.isArrayType()`, `isTupleType()`) instead of manual property-name checks — checking for a `length` property classifies `string` and other types as arrays
- Check that rules obtaining a `TypeChecker` from `parserServices.program` actually pass the checker to the helper functions that require it — a helper signature change without updating the call site will fail to compile
- Check that helpers inspecting type members via `ts.Type#getProperties()` handle all declaration kinds the member can have — for class types, writable fields appear as `ts.SyntaxKind.PropertyDeclaration` (not `PropertySignature`), and setters appear as `ts.SyntaxKind.SetAccessor`. A helper that only gates on `PropertySignature` will silently treat mutable classes as immutable

## Visitor Coverage

Helper functions that build visitor maps are a common reuse pattern, but if they're incomplete, every rule that depends on them inherits the same blind spots. The visitor must cover every place the target construct can appear.

- Check that visitor helpers (e.g., `createFunctionParamVisitor`) visit all declaration forms: `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, `TSDeclareFunction`, `TSFunctionType`, `TSMethodSignature`, and `MethodDefinition`
- Check that adding a new visitor helper is audited against the full list of AST node types where the construct can appear, not just the ones in the initial test cases
- Check that rules inspecting function return types also visit `TSCallSignatureDeclaration` — callable interface/type-literal signatures like `interface Api { (): Promise<Promise<T>> }` have return type annotations that won't be caught if only `TSFunctionType`, `TSMethodSignature`, and function expressions are visited
- Check that constraint-inspecting rules unwrap `TSParenthesizedType` wrappers — a generic bound like `T extends ({...} & {...})` wraps the real constraint in a `TSParenthesizedType`, and a visitor that only checks for `TSIntersectionType` and `TSTypeLiteral` at the top level will silently skip these
- Check that rules inspecting class members for a property consider both `MethodDefinition` and `TSAbstractMethodDefinition` — a helper that only recognises `MethodDefinition` will miss abstract base class methods
- Check that helpers scanning class members also cover `PropertyDefinition` with function values — methods implemented as class-field arrow functions are represented as `PropertyDefinition` nodes with an `ArrowFunctionExpression`/`FunctionExpression` value, and a scanner that only checks `MethodDefinition` will miss real violations
- Check that rules collecting class field information from `ClassBody` also inspect `TSParameterProperty` on constructor parameters — `constructor(readonly count: number) {}` declares a readonly field, but it appears as a `TSParameterProperty` on the `Constructor`'s params, not as a `PropertyDefinition` in the class body
