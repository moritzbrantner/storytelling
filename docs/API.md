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
- `serializeStoryPath(value)` and `parseStoryPath(input)` convert choice ids to and from URL query strings.
- `createStoryPathState(story, options)` builds a reusable resolved path state object.
- `StoryPlayer` renders focused branching playback.
- `StoryScroller` renders either a story-backed scroll experience or custom scroll scenes.
- `StoryContent`, `StoryControls`, `StoryProgress`, `StoryMinimap`, and `StoryStageFrame` expose composable UI pieces.
- `createStoryRendererRegistry(...)`, `getStoryRendererKey(...)`, and `getStoryStageProps(...)` connect serializable stage descriptors to renderer components.

## `./media`

- `StorySubtitleFile`, `StoryAudioFile`, and `StoryVideoFile` render media-focused story stages.
- `createSubtitleStoryScene(...)`, `createAudioStoryScene(...)`, and `createVideoStoryScene(...)` create registry-ready web stage components.
- `parseSubtitleText(...)` and `formatSubtitleTime(...)` expose subtitle parsing utilities.

## `./workflow`

- `storyToWorkflowDocument(story, options)` converts story nodes and edges into a workflow-editor compatible document.
- `workflowDocumentToStory(document, options)` converts that document shape back into a `StoryDocument`.
- `createStoryWorkflowNodeTemplates()` returns a minimal story-node template for workflow-editor palettes.

## `./timeline`

- `storyToTimelineEditorDocument(story, options)` converts a story path into timeline-editor compatible scene items.
- `applyTimelineTimingsToStory(story, document, options)` writes edited item durations back to matching story nodes.
- `createStoryTimelineExtension()` returns a lightweight extension descriptor for story scene items.

## `./remotion`

- `getStoryCompositionProps(story, options)` creates Remotion composition metadata from a story path.
- `StoryRemotionComposition` renders frame-synced scenes.
- `StoryRemotionSceneFrame`, `StoryRemotionContent`, `StoryRemotionProgress`, and `StoryRemotionTransition` expose default Remotion building blocks.

## `./three`

- `StoryCanvasStage` renders a story stage inside React Three Fiber.
