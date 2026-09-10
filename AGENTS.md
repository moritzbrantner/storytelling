# Storytelling agent guidance

## Repository boundary

- Keep `StoryDocument` as the strict, published, JSON-serializable story contract. Incomplete or temporarily invalid authoring state belongs to `StoryDraft`; do not weaken published-document validation to accommodate editor state.
- Keep traversal, validation, graph, path, authoring, and patch semantics target-independent. Renderer- or editor-specific behavior must not become story-domain truth.
- Keep `@moritzbrantner/storytelling/core` and `/schema` safe to consume without React, Remotion, Three.js, browser globals, or target-specific adapter code.
- Treat `/react`, `/media`, `/remotion`, `/three`, `/workflow`, and `/timeline` as adapters over the portable story model. They may translate or render semantics but must not redefine them.
- Preserve the existing public entry points and serialized document/snapshot contracts unless a deliberate compatibility change is required. Do not silently change traversal, tokenization of story state, route selection, or published schema behavior while fixing adapter or example code.
- Keep the example application a consumer and demonstration surface, not the semantic authority for the package.
- Do not reintroduce `@moritzbrantner/ui` merely for local primitives; keep storytelling ownership independent unless a future shared contract provides a concrete product-level reason to couple them again.

## Deterministic work

- Use Bun `1.3.14`, as pinned by `package.json`, and keep dependency installation frozen with `bun install --frozen-lockfile` in validation paths.
- Prefer repository-declared scripts and the `.coding-tooling.json` capabilities over invented validation commands.
- Keep package-consumer verification deterministic. Tests of peer compatibility must not depend on whichever newest package version happens to satisfy a floating range on the day CI runs.
- Keep performance budgets as evidence. Repair regressions or unstable measurements rather than loosening a budget simply to make CI green.

## Acceptance

- For focused changes, run the narrow relevant checks first, then use the existing CI contract for exact-head acceptance.
- Before merging changes to public APIs or story semantics, verify package exports/consumer behavior in addition to unit and type checks.
- Before merging example interaction changes, preserve accessibility semantics and verify the existing E2E path.
- Do not add redundant validation, baselines, suppressions, or placeholder tests as substitutes for fixing a real finding.
