# @moritzbrantner/storytelling

Serializable story documents, branching React playback, and Remotion or
Three-friendly rendering helpers.

## Main APIs

- `defineStory(story)` / `validateStory(story)`
- `resolveStoryPath(story, options)` / `buildStoryTimeline(story, options)`
- `StoryPlayer`, `StoryControls`, `StoryScroller`, `StoryProgress`, and `StoryMinimap`
- `createStoryRendererRegistry(...)`, `getStoryRendererKey(...)`, and `getStoryStageProps(...)`
- `@moritzbrantner/storytelling/remotion` for frame-synced compositions
- `@moritzbrantner/storytelling/three` for Three.js stage rendering

## Story schema

Stories are serializable documents. Nodes can be linear with `next`, branching
with `choices`, or terminal when neither is present.

```ts
import { defineStory } from "@moritzbrantner/storytelling";

export const story = defineStory({
  id: "signal",
  title: "Signal",
  openingNodeId: "wake",
  nodes: [
    {
      id: "wake",
      title: "Wake the observatory",
      content: [{ type: "paragraph", text: "A signal reaches the tower." }],
      choices: [
        { id: "answer", label: "Answer", target: "answer-node" },
        { id: "trace", label: "Trace", target: "trace-node" },
      ],
    },
    {
      id: "answer-node",
      title: "The pilot responds",
      next: "ending",
    },
    {
      id: "trace-node",
      title: "The harbor appears",
      stage: { renderer: "map" },
    },
    {
      id: "ending",
      title: "Contact",
    },
  ],
});
```

`validateStory()` rejects duplicate node ids, duplicate choice ids, missing
targets, missing opening nodes, and cycles. `resolveStoryPath()` returns the
current path for a set of selected choice ids, while `buildStoryTimeline()`
converts that path into frame ranges for video-oriented renderers.

### Linear stories

Use `next` when a story should move through one fixed sequence without multiple
paths. The player renders each `next` link as a single continue action.

```ts
import { defineStory } from "@moritzbrantner/storytelling";

export const linearStory = defineStory({
  id: "bridge-report",
  title: "Bridge Report",
  openingNodeId: "briefing",
  labels: {
    continue: "Continue",
    completedBranch: "The report is complete.",
  },
  nodes: [
    {
      id: "briefing",
      title: "Brief the desk",
      content: [{ type: "paragraph", text: "The editor assigns the morning report." }],
      next: "crossing",
    },
    {
      id: "crossing",
      title: "Ride the first train",
      content: [{ type: "paragraph", text: "The repaired bridge carries commuters again." }],
      next: "publish",
    },
    {
      id: "publish",
      title: "Publish at noon",
      content: [{ type: "paragraph", text: "The sequence ends with one clear update." }],
    },
  ],
});
```

## React playback

Use `StoryPlayer` for focused choice-driven playback, or `StoryScroller` when
the reader should scroll through a snap-aligned sequence of story pages.

```tsx
import { StoryPlayer } from "@moritzbrantner/storytelling";

export function StoryExperience() {
  return <StoryPlayer story={story} />;
}
```

## Example website

Run the local example app from the repository root:

```sh
bun dev
```

The app shows `StoryPlayer`, `StoryScroller`, custom web stage renderers,
branching and linear story presets, and the minimap/state helpers against the
local source files.

## Renderer registry

Renderer registries let the same story document target web, Remotion, and Three
renderers without putting renderer-specific components into the document.

```tsx
import { createStoryRendererRegistry, StoryStageFrame } from "@moritzbrantner/storytelling";

const registry = createStoryRendererRegistry({
  web: {
    map(props) {
      return <div>{props.node.title}</div>;
    },
  },
});
```

## Remotion

The Remotion entrypoint stays behind a subpath so base React consumers do not
need to load Remotion code.

```tsx
import { StoryRemotionComposition } from "@moritzbrantner/storytelling/remotion";

export function VideoStory() {
  return <StoryRemotionComposition story={story} choiceIds={["answer"]} />;
}
```

## Three

The Three entrypoint follows the same pattern and expects `three` and
`@react-three/fiber` as peer dependencies.

```tsx
import { StoryCanvasStage } from "@moritzbrantner/storytelling/three";

export function ThreeStory() {
  return <StoryCanvasStage story={story} choiceIds={["trace"]} />;
}
```

## Adapter decision

The React package keeps `./remotion` and `./three` as subpath exports for now.
Do not split them into separate packages until the base story schema and renderer
registry stabilize and a downstream consumer needs independent adapter release
cadence.

## Standalone verification

This repository publishes `@moritzbrantner/storytelling` as a standalone package
while keeping `./remotion` and `./three` as subpath exports.

```sh
bun run verify
```

The release gate covers formatting, Oxlint diagnostics, forbidden import checks,
type checking, unit tests, build output, package export smoke tests, temporary
consumer install smoke coverage, and package dry-run contents.
