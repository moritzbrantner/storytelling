import { StoryPlayer, defineStory, useStoryPlayer } from "@moritzbrantner/storytelling/react";

const story = defineStory({
  id: "compound-player",
  title: "Compound player",
  openingNodeId: "start",
  nodes: [
    { id: "start", title: "Start", next: "end" },
    { id: "end", title: "End" },
  ],
});

function PlayerProbe() {
  const player = useStoryPlayer();

  return (
    <button type="button" onClick={player.goNext} disabled={!player.canGoNext}>
      {player.isPlaying ? "playing" : player.renderProps.node.title}
    </button>
  );
}

export function CompoundPlayerFixture() {
  return (
    <StoryPlayer.Root story={story} autoplay={{ enabled: false, intervalMs: 1200 }}>
      <StoryPlayer.Layout layout="stacked">
        <StoryPlayer.Stage />
        <StoryPlayer.Aside layout="stacked">
          <StoryPlayer.Header />
          <StoryPlayer.Controls />
          <StoryPlayer.Transport>
            <StoryPlayer.Previous />
            <StoryPlayer.PlayPause />
            <StoryPlayer.Next />
          </StoryPlayer.Transport>
          <StoryPlayer.Progress />
          <StoryPlayer.Trail />
          <StoryPlayer.Menu />
          <PlayerProbe />
        </StoryPlayer.Aside>
      </StoryPlayer.Layout>
    </StoryPlayer.Root>
  );
}
