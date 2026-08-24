# Composition and runtime boundaries

The package separates portable story data from target-specific rendering.

## Import boundaries

Use `@moritzbrantner/storytelling/core` for server-safe story documents, validation, traversal, snapshots, authoring, and patches. This entry point does not import React, Motion, Remotion, Three, or DOM UI.

Use `@moritzbrantner/storytelling/react` when a component or hook needs the interactive React runtime. The package root remains a compatibility client entry point.

Use `@moritzbrantner/storytelling/remotion` and `@moritzbrantner/storytelling/three` for target-specific rendering. Those adapters share the serializable story model and renderer keys; they do not reuse DOM UI components.

## Compound StoryPlayer

`StoryPlayer` remains callable with its existing default layout:

```tsx
<StoryPlayer story={story} />
```

For new composition work, prefer the compound API:

```tsx
import { StoryPlayer } from "@moritzbrantner/storytelling/react";

<StoryPlayer.Root story={story} autoplay={{ enabled: false, intervalMs: 3000 }}>
  <StoryPlayer.Layout layout="split">
    <StoryPlayer.Stage />

    <StoryPlayer.Aside layout="split">
      <StoryPlayer.Header />
      <StoryPlayer.Controls />

      <StoryPlayer.Transport>
        <StoryPlayer.Previous />
        <StoryPlayer.PlayPause />
        <StoryPlayer.Next />
      </StoryPlayer.Transport>

      <StoryPlayer.Progress />
      <StoryPlayer.Menu />
    </StoryPlayer.Aside>
  </StoryPlayer.Layout>
</StoryPlayer.Root>
```

`StoryPlayer.Root` owns the story runtime. The named parts consume that shared controller through context, so they can be rearranged or omitted without duplicating traversal logic.

`useStoryPlayer()` exposes the same controller for headless UI. It includes the underlying `useStoryRuntime()` result plus `isPlaying`, `canGoNext`, `goNext()`, `togglePlaying()`, and `goToHistoryIndex()`.

## Playback behavior

Browser autoplay is deliberately small and target-specific. It advances only when exactly one selectable next choice exists. At a branch it waits for the reader to choose; at an ending it stops. `intervalMs` controls the browser pacing and does not change Remotion frame timing.

The transport primitives use the same controller:

- `Previous` calls the runtime back action.
- `Next` is enabled only when there is one unambiguous selectable next choice.
- `PlayPause` toggles browser autoplay.
- `Menu` lists the visited path and can rewind to an earlier history entry.

This keeps branching decisions explicit while still allowing linear stretches to behave like a player.

## StoryScroller

`StoryScroller` already follows the compound model with `Root`, `Canvas`, `Stage`, `Overlays`, `Menu`, `Minimap`, and `Layout`. Continue to use those parts for scroll-driven experiences and Motion-based scene effects.

## Renderer ownership

Share story documents, traversal semantics, snapshots, renderer keys, and target-neutral state. Keep rendering implementations target-specific:

- React/DOM components for interactive browser playback.
- Motion inside React scenes for browser animation.
- Remotion components for frame-synchronized video rendering.
- Three/React Three Fiber components for 3D stages.

A renderer key may have implementations for several targets without forcing those targets to share one UI component.
