# @moritzbrantner/storytelling

Serializable story documents, branching React playback, and Remotion or
Three-friendly rendering helpers.

## Main APIs

- `defineStory(story)` / `validateStory(story)`
- `validateStoryDocument(story)` / `assertStoryDocument(story)`
- `resolveStoryPath(story, options)` / `buildStoryTimeline(story, options)`
- `compileStory(story)` / `enumerateStoryPaths(story, options)`
- `serializeStoryPath(...)` / `parseStoryPath(...)`
- `StoryPlayer`, `StoryControls`, `StoryScroller`, `StoryProgress`, and `StoryMinimap`
- `createStoryRendererRegistry(...)`, `getStoryRendererKey(...)`, and `getStoryStageProps(...)`
- `@moritzbrantner/storytelling/media` for media-oriented stage helpers
- `@moritzbrantner/storytelling/workflow` for workflow-editor document conversion
- `@moritzbrantner/storytelling/timeline` for timeline-editor document conversion
- `@moritzbrantner/storytelling/remotion` for frame-synced compositions
- `@moritzbrantner/storytelling/three` for Three.js stage rendering

See [docs/API.md](docs/API.md) for the compact public API reference.

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

Use `validateStoryDocument()` when an editor should show all diagnostics instead
of throwing on the first invalid field.

```ts
import { validateStoryDocument } from "@moritzbrantner/storytelling";

const issues = validateStoryDocument(story);
```

Use `compileStory()` and `enumerateStoryPaths()` when an authoring UI needs graph
metadata, branch lists, endings, or all selectable routes through a document.

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
the reader should scroll through scenes that receive normalized numeric progress
and Motion values for scroll-reactive effects.

```tsx
import { StoryScroller } from "@moritzbrantner/storytelling";
import { motion, useTransform, type MotionValue } from "motion/react";

function OpeningMotionScene({
  value,
  scrollProgress,
}: {
  value: number;
  scrollProgress: MotionValue<number>;
}) {
  const opacity = useTransform(scrollProgress, [0, 0.75, 1], [1, 1, 0]);
  const y = useTransform(scrollProgress, [0, 1], [0, -48]);

  return (
    <motion.div style={{ opacity, y }}>
      <OpeningScene scrollValue={value} />
    </motion.div>
  );
}

export function StoryExperience() {
  return (
    <StoryScroller
      transition={{ type: "fade", scrollUnits: 20 }}
      scrollInputScale={0.5}
      scenes={[
        {
          id: "opening",
          title: "Opening",
          transitionToNext: { type: "none" },
          render: ({ value, scrollProgress }) => (
            <OpeningMotionScene value={value} scrollProgress={scrollProgress} />
          ),
        },
      ]}
    />
  );
}
```

`StoryScroller` changes scenes directly by default. Add
`transition={{ type: "fade", scrollUnits: 20 }}` for a scroll-driven crossfade
between every scene, or use `transitionToNext` on an individual scene to
override that boundary. Scroll transition units are normalized scene-local units
from `0` to `100`, not pixels, frames, or seconds.

Use `scrollInputScale` to tune wheel and arrow-key input. `1` is the default:
one arrow press advances by one scene, and wheel deltas are left unchanged.
Values below `1` slow scrolling down; values above `1` speed it up.

Both `StoryPlayer` and story-backed `StoryScroller` support controlled choice
state with `choiceIds`, `defaultChoiceIds`, and `onChoiceIdsChange`. Use
`serializeStoryPath()` and `parseStoryPath()` to put the current path in a URL or
share token.

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

## Media

The media entrypoint exposes reusable stage helpers for subtitle, audio, and
video stories without keeping the older JSX story-node model in the root API.

```tsx
import { createVideoStoryScene } from "@moritzbrantner/storytelling/media";

const registry = createStoryRendererRegistry({
  web: {
    interview: createVideoStoryScene({ src: "/interview.mp4", title: "Interview" }),
  },
});
```

## Workflow And Timeline Adapters

The workflow and timeline entrypoints are pure conversion helpers. They return
plain objects shaped for `@moritzbrantner/workflow-editor` and
`@moritzbrantner/timeline-editor`, but they do not import those packages.

```ts
import { storyToTimelineEditorDocument } from "@moritzbrantner/storytelling/timeline";
import { storyToWorkflowDocument } from "@moritzbrantner/storytelling/workflow";

const workflowDocument = storyToWorkflowDocument(story);
const timelineDocument = storyToTimelineEditorDocument(story, { choiceIds: ["answer"] });
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
