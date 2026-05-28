# Public API Reference

This reference tracks the package exports that are intended for consumers.

## Root Export

- `defineStory(story, options?)` validates and returns a serializable `StoryDocument`.
- `validateStory(story, options?)` and `assertStoryDocument(story, options?)` throw `StoryValidationError` when invalid.
- `validateStoryDocument(story, options?)` returns `StoryValidationIssue[]` without throwing.
- `resolveStoryPath(story, options)` resolves the active node path for selected choice ids and reports consumed, unconsumed, and invalid choice ids.
- `buildStoryTimeline(story, options)` converts a resolved path into frame ranges.
- `compileStory(story)` returns node and edge lookups for authoring tools.
- `getStoryBranches(compiledStory)` returns nodes with multiple enabled outgoing choices.
- `getStoryEndings(compiledStory)` returns terminal nodes.
- `enumerateStoryPaths(story, options)` returns every selectable path through an acyclic story.
- `analyzeStory(story, options)` returns validation errors, authoring warnings, graph reachability, and story metrics for editor UIs.
- `getStoryReachability(story)` returns reachable and unreachable node ids without requiring a full report.
- `applyStoryPatch(story, patch, options)` applies immutable story-edit operations for editor drafts.
- `createStoryNode(input)` creates a serializable story node object from required id/title fields plus optional node fields.
- `serializeStoryPath(value)` and `parseStoryPath(input)` convert choice ids to and from URL query strings.
- `createStoryPathState(story, options)` builds a reusable resolved path state object.
- `useStoryPathState(story, options)` provides controlled or uncontrolled headless React path state for custom authoring UIs.
- `StoryPlayer` renders focused branching playback.
- `StoryScroller` renders either a story-backed scroll experience or custom scroll scenes, with optional `autoplay` pacing.
- `StoryContent`, `StoryControls`, `StoryProgress`, `StoryMinimap`, and `StoryStageFrame` expose composable UI pieces.
- `createStoryRendererRegistry(...)`, `getStoryRendererKey(...)`, and `getStoryStageProps(...)` connect serializable stage descriptors to renderer components.

### Validation Modes

- Validation defaults to `mode: "compat"` for existing documents.
- Pass `{ mode: "strict" }` to `defineStory`, `validateStory`,
  `assertStoryDocument`, or `validateStoryDocument` to reject blank strings,
  invalid ids, nodes that declare both `next` and `choices`, invalid content
  blocks, and invalid numeric durations.
- Strict ids must match `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/`.
- Strict numeric constraints are `durationInFrames >= 1`,
  `transition.durationInFrames >= 0`, and `scrollUnits > 0`.
- `analyzeStory(story)` reports strict-only validation problems as warnings.
  Use `analyzeStory(story, { validationMode: "strict" })` to report them as
  errors.

### Path State

- `ResolvedStoryPath` includes `consumedChoiceIds`, `unconsumedChoiceIds`, and
  `stoppedReason`.
- `stoppedReason` is one of `ending`, `awaiting-choice`, `invalid-choice`,
  `stop-at`, or `max-steps`.
- `useStoryPathState` accepts `stopAt`, `defaultStopAt`, and
  `onStopAtChange`, and returns `stopAt` plus `setStopAt`.
- With `autoAdvanceLinearNodes`, `goBack()` moves to the previous generated
  linear node by setting `stopAt`.

### Story Patches

- `applyStoryPatch` throws for missing nodes or choices by default. Pass
  `{ onMissing: "ignore" }` for legacy no-op behavior.
- Use `{ type: "rename-node", nodeId, nextNodeId }` to change a node id. This
  updates `openingNodeId`, `next`, and choice targets.
- `update-node` rejects `fields.id`; callers must use `rename-node`.
- Removing the opening node requires `nextOpeningNodeId` unless no nodes remain.
- `validate: true` honors `validationMode`.

### `StoryScroller` Autoscroll

- `autoplay={true}` advances at the default pace of `20` scene units per second.
- `autoplay={{ unitsPerSecond: 12 }}` sets a custom pace.
- `autoplay={{ enabled, unitsPerSecond }}` supports external play/pause controls.
- `scrollInputScale` still applies to wheel and Arrow Up/Arrow Down scroll input while autoscroll is enabled.
- Tapping Arrow Up or Arrow Down for less than `300ms` scrolls by `10` scene units on release; holding past that threshold scrolls smoothly at `20` scene units per second.
- Arrow Right and Arrow Left jump to the next or previous scene.
- Autoscroll is disabled when the user prefers reduced motion.

### `StoryScroller` Transitions

- `scrollUnits` on a custom `StoryScrollScene` or serializable `StoryNode` sets
  that scene body's timeline length. The default is `100`; invalid, non-finite,
  and `<= 0` values fall back to `100`.
- `transition` sets the default scene handoff for the whole scroller.
- `transitionToNext` on a scene overrides the global transition for that scene boundary.
- Supported transition types are `none`, `fade`, `slide`, `push`, `wipe`, `zoom`, and `blur`.
- Animated transitions use `scrollUnits` as timeline units added after the
  outgoing scene body. A `20` unit transition after a default scene runs from
  `100` to `120`, holding the outgoing scene at its final frame until the next
  scene starts.
- `scrollUnits: 0` is treated as a direct `none` transition.
- `slide`, `push`, and `wipe` accept `direction: "up" | "down" | "left" | "right"`.
- `zoom` accepts `fromScale` and `toScale`.
- `blur` accepts `maxBlur`.
- Existing `{ type: "none" }` and `{ type: "fade", scrollUnits }` values remain compatible.
- Animated transition previews are disabled when the user prefers reduced motion.
- Custom `StoryScrollScene` ids and titles are validated in development.
- Numeric choice hotkeys are scoped to the focused scroller region.
- Story-backed scrollers allow branch re-selection by default when a user
  scrolls back to an answered branch scene. Set `allowBranchReselection={false}`
  to keep those branch choices locked after a path has been selected.

## `./media`

- `StorySubtitleFile`, `StoryAudioFile`, and `StoryVideoFile` render media-focused story stages.
- `createSubtitleStoryScene(...)`, `createAudioStoryScene(...)`, and `createVideoStoryScene(...)` create registry-ready web stage components.
- `parseSubtitleText(...)` and `formatSubtitleTime(...)` expose subtitle parsing utilities.
- Subtitle parsing skips cues with invalid or non-increasing time ranges.

## `./workflow`

- `storyToWorkflowDocument(story, options)` converts story nodes and edges into a workflow-editor compatible document.
- `workflowDocumentToStory(document, options)` converts that document shape back into a `StoryDocument`.
- `createStoryWorkflowNodeTemplates()` returns a minimal story-node template for workflow-editor palettes.
- `storyToWorkflowDocument` accepts `positions`, `direction`, `includeDiagnostics`, and `allowInvalid` layout options for editor roundtrips.
- Use `{ allowInvalid: true, includeDiagnostics: true }` to build workflow
  documents from draft stories that do not pass graph validation.

## `./timeline`

- `storyToTimelineEditorDocument(story, options)` converts a story path into timeline-editor compatible scene items.
- `applyTimelineTimingsToStory(story, document, options)` writes edited item durations back to matching story nodes.
- `createStoryTimelineExtension()` returns a lightweight extension descriptor for story scene items.
- `storyToTimelineEditorDocument` accepts `includeBranchMarkers` to add branch and ending markers alongside scene markers.
- Timeline `fps` must be finite and greater than `0`.
- When multiple timeline items target the same node, the last matching item
  determines that node's duration.

## `./remotion`

- `getStoryCompositionProps(story, options)` creates Remotion composition metadata from a story path.
- `StoryRemotionComposition` renders frame-synced scenes.
- `StoryRemotionSceneFrame`, `StoryRemotionContent`, `StoryRemotionProgress`, and `StoryRemotionTransition` expose default Remotion building blocks.
- Remotion `fps` must be finite and greater than `0`; scene progress is clamped
  to `0..1`.

## `./three`

- `StoryCanvasStage` renders a story stage inside React Three Fiber.
