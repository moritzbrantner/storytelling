# @moritzbrantner/storytelling

## Unreleased

### Minor Changes

- Add nested story scenes with `StoryNode.children`, depth-first path
  traversal, hierarchy metadata, and recursive validation, authoring, patch,
  workflow, timeline, scroller, and Remotion support.

## 0.4.0 - 2026-05-28

### Minor Changes

- Add opt-in strict story validation for blank fields, invalid ids, ambiguous
  `next` plus `choices` nodes, invalid content blocks, and unsafe numeric
  durations.
- Add path-resolution metadata for consumed choice ids, unconsumed choice ids,
  and stop reasons.
- Add `stopAt` support to `useStoryPathState`, including backward navigation
  through auto-advanced linear stories.
- Add `rename-node` story patches and make patch operations throw for missing
  nodes or choices by default.

### Patch Changes

- Scope `StoryScroller` numeric hotkeys to the focused scroller and validate
  custom scene ids/titles in development.
- Harden Remotion and timeline adapters against invalid `fps`, zero-transition
  Remotion scenes, and invalid timeline item durations.
- Add draft-safe workflow conversion with `allowInvalid` and diagnostics.
- Skip subtitle cues with invalid or non-increasing time ranges.
- Add MIT license and public npm release automation.
- Expand release gate with example build and e2e coverage.

## 0.3.1

### Patch Changes

- Updated dependencies:
  - @moritzbrantner/ui@0.4.0

## 0.3.0

### Minor Changes

- Redesign the package around a serializable `StoryDocument` model shared by
  branching playback, scroll previews, Three.js stages, and Remotion rendering.
- Replace renderer components embedded on story nodes with
  `StoryRendererRegistry`.
- Replace `InteractiveStoryPlayer` with `StoryPlayer`.
- Replace `StoryContainer`, `StorySeries`, and `StoryScene` with
  `StoryScroller`.
- Replace JSX node bodies with structured `StoryContentBlock[]` content.
- Expand `@moritzbrantner/storytelling/remotion` with
  `getStoryCompositionProps`, Remotion scene primitives, and registry-backed
  composition rendering.

## 0.2.1

### Patch Changes

- Release every package in the workspace.

- Updated dependencies []:
  - @moritzbrantner/ui@0.3.1

## 0.2.0

### Minor Changes

- [`0ce32d3`](https://github.com/moritzbrantner/platform-packages/commit/0ce32d343359c34f751aaf54f8be63e769f63fa5) - Extract the shared UI primitives and storytelling runtime into publishable platform packages.

### Patch Changes

- Updated dependencies [[`0ce32d3`](https://github.com/moritzbrantner/platform-packages/commit/0ce32d343359c34f751aaf54f8be63e769f63fa5)]:
  - @moritzbrantner/ui@0.3.0
