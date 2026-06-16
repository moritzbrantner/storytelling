# Public API Reference

This reference tracks the package exports that are intended for consumers.

## Core Export

`@moritzbrantner/storytelling/core` exposes server-safe, serializable helpers
only. It does not import React components, Motion, Remotion, Three, or DOM-only
UI modules.

- `defineStory`, `validateStory`, `assertStoryDocument`, and
  `validateStoryDocument`
- `resolveStoryPath`, `buildStoryTimeline`, `serializeStorySnapshot`,
  `parseStorySnapshot`, and `createStoryPathState`
- `compileStory`, `enumerateStoryPaths`, `getStoryBranches`, and
  `getStoryEndings`
- `analyzeStory`, `getStoryReachability`, `applyStoryPatch`, and
  `createStoryNode`
- Story model, validation, graph, path, authoring, and patch types

## Schema Export

`@moritzbrantner/storytelling/schema` exports `storyDocumentJsonSchema` and
`createStoryDocumentJsonSchema(...)`, a closed portable baseline schema plus an
extension helper for explicit custom content block schemas.

## Root Export

- `defineStory(story, options?)` validates and returns a serializable `StoryDocument`.
- `validateStory(story, options?)` and `assertStoryDocument(story, options?)` throw `StoryValidationError` when invalid.
- `validateStoryDocument(story, options?)` returns `StoryValidationIssue[]` without throwing.
- `resolveStoryPath(story, options)` resolves the active node path from a
  `StorySnapshot`, optional `choose` choice id, and optional state hooks.
  Static non-interactive routes use `routeChoiceIds`.
- `buildStoryTimeline(story, options)` converts a resolved path into frame ranges.
- `compileStory(story)` returns node and edge lookups for authoring tools.
- `getStoryBranches(compiledStory)` returns nodes with multiple enabled outgoing choices.
- `getStoryEndings(compiledStory)` returns terminal nodes.
- `getStoryNodeEntries(story)`, `getStoryNodes(story)`, and
  `getStoryNodeEntry(story, nodeId)` expose the flattened nested node tree with
  parent, ancestor, depth, index, and source-path metadata.
- `enumerateStoryPaths(story, options)` returns every selectable path through an acyclic story.
- `analyzeStoryDraft(story, options)` returns validation errors, authoring warnings, graph reachability, and story metrics for editor UIs. `analyzeStory` remains an alias.
- `getStoryReachability(story)` returns reachable and unreachable node ids without requiring a full report.
- `applyStoryPatch(story, patch, options)` applies immutable story-edit operations for editor drafts.
- `createStoryNode(input)` creates a serializable story node object from required id/title fields plus optional node fields.
- `serializeStorySnapshot(value)` and `parseStorySnapshot(input)` convert a
  runtime snapshot to and from a `storyState=` query string.
- `createStoryPathState(story, options)` builds a reusable resolved path state object.
- `useStoryPathState(story, options)` provides controlled or uncontrolled headless React path state for custom authoring UIs.
- `useStoryRuntime(story, options)` provides reusable player-grade state, labels, actions, and `StoryRenderProps`.
- `createStoryRenderProps(...)`, `buildPathFromHistory(...)`, and
  `createStoryPathStateFromHistory(...)`
  expose shared runtime helpers for custom adapters.
- `StoryPlayer` renders focused branching playback. Use grouped `slots` to
  replace stage, header, controls, actions, progress, and trail modules, and
  grouped `modules` to disable optional UI pieces.
- `StoryScroller` renders either a story-backed scroll experience or custom
  scroll scenes, with optional `autoplay` pacing, story-backed slots, and an
  opt-in default minimap module.
- `StoryScrollTimeline` renders generic scroll scenes without requiring a story
  document.
- `StoryContent`, `StoryChoiceList`, `StoryChoicePanel`, `StoryControls`,
  `StoryActionBar`, `StoryProgress`, `StoryMinimap`, and `StoryStageFrame`
  expose composable UI pieces.
- `createStoryRendererRegistry(...)`, `getStoryRendererKey(...)`, and `getStoryStageProps(...)` connect serializable stage descriptors to renderer components.

### Validation Modes

- Validation defaults to strict published-document rules.
- Pass `{ mode: "compat" }` only for legacy importers that need lenient
  validation while they migrate.
- Strict validation rejects blank strings, invalid ids, nodes that declare both
  `next` and `choices`, invalid content blocks, invalid numeric durations,
  non-object `initialState`, and function-bearing document fields.
- Strict ids must match `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/`.
- Strict numeric constraints are `durationInFrames >= 1`,
  `transition.durationInFrames >= 0`, and `scrollUnits > 0`.
- `analyzeStoryDraft(story)` reports strict validation problems as authoring
  errors without throwing.

### Path State

- `StoryState` is an application-defined JSON object. Empty state defaults to `{}`.
- `StorySnapshot` stores the current node id, history, runtime state, and
  stopped reason. It is the preferred controlled runtime value for players and
  scrollers.
- `StoryChoice` supports static `hidden` and `disabled`.
- `StoryStateHooks` can provide document-level `createInitialState`,
  `canEnterNode`, `isChoiceVisible`, `isChoiceEnabled`, `applyChoice`, and
  `applyNode` hooks.
- Reducers run in this order: global choice reducer, then global node reducer
  for the target node.
- If a target node cannot be entered, resolution stops with
  `blocked-by-condition`.
- `StoryNode.children` nests serializable story scenes under a parent node.
  Node ids remain globally unique across the full tree, and `openingNodeId`,
  `next`, and choice targets may point to nodes at any depth.
- Nested story playback is depth-first: the parent renders first, then its
  children render in order, and the last descendant falls through to the
  parent `next` target or inherited continuation.
- Explicit `choices` take priority over automatic child traversal. A parent
  with choices can still declare `children`, but those children are only reached
  when targeted by a choice or another link.
- `StoryRenderProps.nodeEntry` and `StoryTimelineScene.nodeEntry` include
  optional hierarchy metadata for breadcrumbs, minimaps, and editors.
- `ResolvedStoryPath` includes `state`, `snapshot`, `consumedChoiceIds`,
  `unconsumedChoiceIds`, and `stoppedReason`.
- `stoppedReason` is one of `ending`, `awaiting-choice`, `invalid-choice`,
  `blocked-by-condition`, `stop-at`, or `max-steps`.
- `useStoryPathState` accepts `snapshot`, `defaultSnapshot`, `defaultState`,
  `hooks`, `onSnapshotChange`, `stopAt`, `defaultStopAt`, and `onStopAtChange`,
  and returns `snapshot`, `state`, `setSnapshot`, `setRuntimeState`, `stopAt`,
  and `setStopAt`.
- With `autoAdvanceLinearNodes`, `goBack()` moves to the previous generated
  linear node by setting `stopAt`.
- `useStoryRuntime` builds on `useStoryPathState` and returns `story`, `state`,
  `renderProps`, default labels, normalized progress, and navigation actions for
  custom player layouts.

### Composable React UI

- `StoryPlayer` accepts `layout: "split" | "stacked" | "stage-only"`.
- Prefer `StoryPlayer` `slots` for new composition work. Existing direct render
  props remain supported and take precedence over grouped slots:
  `renderStage`, `renderHeader`, `renderControls`, `renderActions`,
  `renderProgress`, and `renderTrail`.
- `StoryPlayer` `modules` can disable `header`, `controls`, `actions`,
  `progress`, and `trail`. Disabled modules do not mount their slot renderers.
- `StoryControls` now prefers `onChoose` and `isEnding`; `choose` and `ending`
  remain as compatibility aliases.
- `StoryChoiceList` renders choice buttons, `StoryChoicePanel` renders the
  scroller overlay, `StoryActionBar` renders back/restart controls, and
  `StoryPathTrail` renders the visited path.
- `StoryScroller` is callable for the default scroller and also exposes
  compound parts for custom layouts: `StoryScroller.Root`,
  `StoryScroller.Canvas`, `StoryScroller.Stage`,
  `StoryScroller.Overlays`, `StoryScroller.Menu`,
  `StoryScroller.Minimap`, and `StoryScroller.Layout`.
- `useStoryScrollerController`, `useStoryScroller`, and
  `useStoryScrollerScene` expose the controller, root context, and per-scene
  render context for headless scroller layouts.
- `StoryContent` accepts typed `renderers` and `renderBlock`. Built-in content
  blocks still render by default, and `createStoryContentRendererRegistry(...)`
  helps type keyed renderer maps.
- Built-in content blocks are `paragraph`, `heading`, `quote`, `list`, `image`,
  `audio`, `video`, `table`, `code`, `chart`, `embed`, `callout`, and
  `markdown`.
- Default `markdown` rendering is escaped plain text with preserved whitespace.
  Rich markdown rendering should be supplied through a custom renderer or the
  optional `@moritzbrantner/storytelling/adapters/markdown` export.
- Default `chart` rendering is intentionally basic SVG plus an accessible table
  fallback. Rich charts should be supplied through a custom renderer or the
  optional `@moritzbrantner/storytelling/adapters/charts` export.

```tsx
<StoryPlayer
  story={story}
  modules={{ controls: false, progress: false, trail: false }}
  slots={{ actions: (props) => <Toolbar restart={props.restart} /> }}
/>

<StoryScroller story={story} modules={{ minimap: true }} />

<StoryScroller.Root story={story} registry={storyRegistry}>
  <StoryScroller.Layout className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <StoryScroller.Canvas>
      <StoryScroller.Stage />
      <StoryScroller.Overlays />
    </StoryScroller.Canvas>

    <aside className="grid gap-4">
      <StoryScroller.Menu />
      <StoryScroller.Minimap collapsible />
    </aside>
  </StoryScroller.Layout>
</StoryScroller.Root>
```

### Story Patches

- `applyStoryPatch` throws for missing nodes or choices by default. Pass
  `{ onMissing: "ignore" }` for legacy no-op behavior.
- `add-node` accepts `parentNodeId` to add a nested child; omitted still inserts
  at the top level. `move-node` also accepts `parentNodeId` and rejects moving a
  node into itself or its descendants.
- Use `{ type: "rename-node", nodeId, nextNodeId }` to change a node id. This
  updates `openingNodeId`, `next`, and choice targets across nested descendants.
- Use `move-node` and `move-choice` to reorder authoring lists without changing
  ids, references, choice targets, or node data.
- Use `add-content-block`, `update-content-block`, `remove-content-block`, and
  `move-content-block` for immutable content edits. Invalid content indexes
  always throw, even with `{ onMissing: "ignore" }`.
- `update-node` rejects `fields.id`; callers must use `rename-node`.
- Removing a node removes its whole subtree. Removing the opening node or an
  ancestor of it requires `nextOpeningNodeId` unless no nodes remain.
- `validate: true` honors `validationMode`.

### Authoring Fixes

- `analyzeStoryDraft(story, { includeFixes: true })` adds `fixes` to safe,
  deterministic diagnostics.
- Initial fixes cover removing unreachable nodes, adding placeholder paragraph
  content to reachable empty nodes, removing disabled-only empty branch choices,
  removing strict-mode blank choice descriptions, and normalizing simple blank
  titles or ids when the result is deterministic.
- Diagnostics omit fixes when no safe automatic patch exists, such as missing
  author-written choice descriptions.

### `StoryScroller` Autoscroll

- `autoplay={true}` advances at the default pace of `20` scene units per second.
- `autoplay={{ unitsPerSecond: 12 }}` sets a custom pace.
- `autoplay={{ enabled, unitsPerSecond }}` supports external play/pause controls.
- `scrollInputScale` still applies to wheel and Arrow Up/Arrow Down scroll input while autoscroll is enabled.
- Tapping Arrow Up or Arrow Down for less than `300ms` scrolls by `10` scene units on release; holding past that threshold scrolls smoothly at `20` scene units per second.
- Arrow Right and Arrow Left jump to the next or previous scene.
- Autoscroll is disabled when the user prefers reduced motion.

### `StoryScrollTimeline`

- `StoryScrollTimeline` is the generic scroll scene player used by
  `StoryScroller`.
- `buildScrollTimeline(scenes, transition, reducedMotion?)` returns timeline
  entries with start/body/end units.
- `getScrollTransitionStyles(transition, progress)` returns active and preview
  styles for custom scroll renderers.
- `useStoryScrollTimeline({ scenes, transition, reducedMotion })` returns the
  computed timeline, total units, and reduced-motion state.

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
- Prefer the compound `StoryScroller.Root` API for new composition work.
  Existing direct render props remain supported by the callable component and
  take precedence over grouped slots: `renderScene`, `renderChoicePanel`, and
  `renderMinimap`. `renderScene` receives `StoryRenderProps` plus the active
  scroll scene render props.
- `StoryScroller` `modules.choicePanel=false` disables the default branch
  overlay. `modules.minimap` is off by default; set it to `true` or an options
  object to render the built-in `StoryMinimap` for story-backed scrollers.
- Story-backed scrollers flatten nested `StoryNode.children` into normal scroll
  pages and pass hierarchy metadata to custom minimap items. Custom
  `StoryScrollScene[]` arrays remain flat.

## `./media`

- `StorySubtitleFile`, `StoryAudioFile`, and `StoryVideoFile` render media-focused story stages.
- `createSubtitleStoryScene(...)`, `createAudioStoryScene(...)`, and `createVideoStoryScene(...)` create registry-ready web stage components.
- `parseSubtitleText(...)` and `formatSubtitleTime(...)` expose subtitle parsing utilities.
- Subtitle parsing skips cues with invalid or non-increasing time ranges.

## `./workflow`

- `storyToWorkflowDocument(story, options)` converts story nodes and edges into a workflow-editor compatible document.
- `workflowDocumentToStory(document, options)` converts that document shape back into a flat `StoryDocument`.
- `createStoryWorkflowNodeTemplates()` returns a minimal story-node template for workflow-editor palettes.
- `storyToWorkflowDocument` accepts `positions`, `direction`, `includeDiagnostics`, and `allowInvalid` layout options for editor roundtrips.
- Nested story nodes are exported as workflow nodes with category paths derived
  from their ancestors. Workflow import currently flattens hierarchy unless the
  caller restores nesting from its own metadata.
- Use `{ allowInvalid: true, includeDiagnostics: true }` to build workflow
  documents from draft stories that do not pass graph validation.

## `./timeline`

- `storyToTimelineEditorDocument(story, options)` converts a story path into timeline-editor compatible scene items.
- `applyTimelineTimingsToStory(story, document, options)` writes edited item durations back to matching story nodes.
- Nested story scenes are emitted in flattened path order, and timeline item
  data includes `nodeEntry` hierarchy metadata.
- `createStoryTimelineExtension()` returns a lightweight extension descriptor for story scene items.
- `storyToTimelineEditorDocument` accepts `routeChoiceIds` and
  `includeBranchMarkers` to add branch and ending markers alongside scene markers.
- Timeline `fps` must be finite and greater than `0`.
- When multiple timeline items target the same node, the last matching item
  determines that node's duration.

## `./remotion`

- `getStoryCompositionProps(story, options)` creates Remotion composition metadata from a story path.
- `StoryRemotionComposition` renders frame-synced scenes.
- `StoryRemotionSceneFrame`, `StoryRemotionContent`, `StoryRemotionProgress`, and `StoryRemotionTransition` expose default Remotion building blocks.
- Remotion `fps` must be finite and greater than `0`; scene progress is clamped
  to `0..1`.
- `getStoryCompositionProps()` returns props that can be spread into Remotion's
  `<Composition>` together with `component={StoryRemotionComposition}`.
- Keep `defaultProps` JSON-serializable. `story`, `routeChoiceIds`, and `layout` are
  safe; custom renderer `registry` objects contain functions and must be
  imported inside the Remotion bundle instead of being passed through
  `defaultProps` or renderer `inputProps`.

## `./three`

- `StoryCanvasStage` renders a story stage inside React Three Fiber.
