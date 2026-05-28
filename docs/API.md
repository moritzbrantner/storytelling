# Public API Reference

This reference tracks the package exports that are intended for consumers.

## Root Export

- `defineStory(story)` validates and returns a serializable `StoryDocument`.
- `validateStory(story)` and `assertStoryDocument(story)` throw `StoryValidationError` when invalid.
- `validateStoryDocument(story)` returns `StoryValidationIssue[]` without throwing.
- `resolveStoryPath(story, options)` resolves the active node path for selected choice ids.
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

### `StoryScroller` Autoscroll

- `autoplay={true}` advances at the default pace of `20` scene units per second.
- `autoplay={{ unitsPerSecond: 12 }}` sets a custom pace.
- `autoplay={{ enabled, unitsPerSecond }}` supports external play/pause controls.
- `scrollInputScale` still applies to wheel and arrow-key input while autoscroll is enabled.
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

## `./media`

- `StorySubtitleFile`, `StoryAudioFile`, and `StoryVideoFile` render media-focused story stages.
- `createSubtitleStoryScene(...)`, `createAudioStoryScene(...)`, and `createVideoStoryScene(...)` create registry-ready web stage components.
- `parseSubtitleText(...)` and `formatSubtitleTime(...)` expose subtitle parsing utilities.

## `./workflow`

- `storyToWorkflowDocument(story, options)` converts story nodes and edges into a workflow-editor compatible document.
- `workflowDocumentToStory(document, options)` converts that document shape back into a `StoryDocument`.
- `createStoryWorkflowNodeTemplates()` returns a minimal story-node template for workflow-editor palettes.
- `storyToWorkflowDocument` accepts `positions`, `direction`, and `includeDiagnostics` layout options for editor roundtrips.

## `./timeline`

- `storyToTimelineEditorDocument(story, options)` converts a story path into timeline-editor compatible scene items.
- `applyTimelineTimingsToStory(story, document, options)` writes edited item durations back to matching story nodes.
- `createStoryTimelineExtension()` returns a lightweight extension descriptor for story scene items.
- `storyToTimelineEditorDocument` accepts `includeBranchMarkers` to add branch and ending markers alongside scene markers.

## `./remotion`

- `getStoryCompositionProps(story, options)` creates Remotion composition metadata from a story path.
- `StoryRemotionComposition` renders frame-synced scenes.
- `StoryRemotionSceneFrame`, `StoryRemotionContent`, `StoryRemotionProgress`, and `StoryRemotionTransition` expose default Remotion building blocks.

## `./three`

- `StoryCanvasStage` renders a story stage inside React Three Fiber.
