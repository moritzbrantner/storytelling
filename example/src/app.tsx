import { useEffect, useMemo, useState } from "react";

import {
  StoryMinimap,
  StoryPlayer,
  StoryScroller,
  resolveStoryPath,
  type StoryDocument,
  type StoryHistoryEntry,
  type StoryScrollScene,
  type StoryScrollTransition,
} from "@moritzbrantner/storytelling";

import {
  linearStory,
  motionLabScenes,
  signalStory,
  storyRegistry,
  type MotionLabSceneData,
  type SignalStoryData,
} from "./story";

type ExampleMode = "player" | "scroller";
type ExampleStoryId = "branching" | "linear" | "motion";

type PathPreset = {
  id: string;
  label: string;
  choiceIds: string[];
};

type ExampleStory = {
  id: Exclude<ExampleStoryId, "motion">;
  label: string;
  story: StoryDocument<SignalStoryData>;
  presets: PathPreset[];
};

type MotionPreset = {
  id: string;
  label: string;
  transition: StoryScrollTransition;
};

const storyOptions: { id: ExampleStoryId; label: string }[] = [
  { id: "branching", label: "Branching" },
  { id: "linear", label: "Linear" },
  { id: "motion", label: "Motion" },
];

const exampleStories: ExampleStory[] = [
  {
    id: "branching",
    label: "Branching",
    story: signalStory,
    presets: [
      { id: "opening", label: "Opening", choiceIds: [] },
      { id: "pilot", label: "Pilot", choiceIds: ["answer"] },
      { id: "harbor-team", label: "Harbor team", choiceIds: ["trace", "send-team"] },
      { id: "archive", label: "Archive", choiceIds: ["archive"] },
    ],
  },
  {
    id: "linear",
    label: "Linear",
    story: linearStory,
    presets: [
      { id: "linear-opening", label: "Opening", choiceIds: [] },
      {
        id: "linear-complete",
        label: "Full sequence",
        choiceIds: ["briefing__continue", "field-report__continue", "edit-room__continue"],
      },
    ],
  },
];

const motionPresets: MotionPreset[] = [
  { id: "soft-fade", label: "Soft fade", transition: { type: "fade", scrollUnits: 18 } },
  { id: "long-fade", label: "Long fade", transition: { type: "fade", scrollUnits: 34 } },
  { id: "direct", label: "Direct", transition: { type: "none" } },
];

function getStoryScrollerPageId(storyId: string, nodeId: string) {
  return `story-scroller-page-${storyId}-${nodeId}`;
}

function getHistorySummary(
  story: StoryDocument<SignalStoryData>,
  history: StoryHistoryEntry<SignalStoryData>[],
) {
  if (history.length === 0) {
    return "No active path";
  }

  return history
    .map((entry, index) => {
      const node = story.nodes.find((candidate) => candidate.id === entry.nodeId);
      return `${index + 1}. ${node?.title ?? entry.nodeId}`;
    })
    .join("\n");
}

function getSceneSummary(
  scenes: StoryScrollScene<MotionLabSceneData>[],
  activeIndex: number,
  progress: number,
) {
  const activeScene = scenes[activeIndex] ?? scenes[0];

  if (!activeScene) {
    return "No active scene";
  }

  return `${activeScene.title}\nProgress ${Math.round(progress)}%\nScene ${activeIndex + 1} of ${
    scenes.length
  }`;
}

export function ExampleApp() {
  const [storyId, setStoryId] = useState<ExampleStoryId>("branching");
  const [mode, setMode] = useState<ExampleMode>("player");
  const [scrollerActiveIndex, setScrollerActiveIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0);
  const isMotionStory = storyId === "motion";
  const activeExample =
    exampleStories.find((example) => example.id === storyId) ?? exampleStories[0]!;
  const [presetId, setPresetId] = useState(activeExample.presets[0]?.id ?? "opening");
  const [history, setHistory] = useState<StoryHistoryEntry<SignalStoryData>[]>([]);
  const activePreset =
    activeExample.presets.find((preset) => preset.id === presetId) ?? activeExample.presets[0]!;
  const activeMotionPreset =
    motionPresets.find((preset) => preset.id === presetId) ?? motionPresets[0]!;
  const presetPath = useMemo(
    () =>
      resolveStoryPath(activeExample.story, {
        choiceIds: activePreset.choiceIds,
        autoAdvanceLinearNodes: activePreset.choiceIds.length > 0,
      }),
    [activeExample.story, activePreset.choiceIds],
  );
  const linearScrollPath = useMemo(
    () =>
      resolveStoryPath(activeExample.story, {
        autoAdvanceLinearNodes: true,
      }),
    [activeExample.story],
  );
  const isLinearStory = storyId === "linear";
  const isScrollerMode = isMotionStory || isLinearStory || mode === "scroller";
  const visibleHistory = isLinearStory
    ? linearScrollPath.history
    : history.length > 0
      ? history
      : presetPath.history;
  const activeMinimapIndex = isScrollerMode
    ? scrollerActiveIndex
    : Math.max(visibleHistory.length - 1, 0);
  const showBranchControls = !isLinearStory && !isMotionStory;
  const minimapItems = isMotionStory
    ? motionLabScenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        eyebrow: scene.eyebrow,
      }))
    : visibleHistory.map((entry) => {
        const node = activeExample.story.nodes.find((candidate) => candidate.id === entry.nodeId);

        return {
          id: entry.nodeId,
          title: node?.title ?? entry.nodeId,
          eyebrow: node?.eyebrow,
        };
      });

  useEffect(() => {
    setScrollerActiveIndex(0);
    setSceneProgress(0);
  }, [storyId, activePreset.id, activeMotionPreset.id, mode]);

  useEffect(() => {
    if ((isLinearStory || isMotionStory) && mode !== "scroller") {
      setMode("scroller");
    }
  }, [isLinearStory, isMotionStory, mode]);

  const selectMinimapItem = (index: number) => {
    if (!isScrollerMode) return;

    if (isMotionStory) {
      const scene = motionLabScenes[index];
      if (!scene) return;

      setScrollerActiveIndex(index);
      document.getElementById(scene.id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }

    const entry = visibleHistory[index];
    if (!entry) return;

    setScrollerActiveIndex(index);
    document
      .getElementById(getStoryScrollerPageId(activeExample.story.id, entry.nodeId))
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  return (
    <main className="example-shell">
      <section className="example-workspace" aria-labelledby="example-title">
        <header className="example-toolbar">
          <div>
            <p className="example-kicker">Example website</p>
            <h1 id="example-title">Storytelling component lab</h1>
          </div>

          <div className="example-toolbar-controls" aria-label="Example controls">
            <div className="example-segment" role="tablist" aria-label="Story type">
              {storyOptions.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  role="tab"
                  aria-selected={storyId === example.id}
                  data-active={storyId === example.id}
                  onClick={() => {
                    setStoryId(example.id);
                    if (example.id === "motion") {
                      setPresetId(motionPresets[0]?.id ?? "soft-fade");
                    } else {
                      const nextExample =
                        exampleStories.find((candidate) => candidate.id === example.id) ??
                        exampleStories[0]!;
                      setPresetId(nextExample.presets[0]?.id ?? "opening");
                    }
                    if (example.id === "linear" || example.id === "motion") {
                      setMode("scroller");
                    }
                    setHistory([]);
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>

            {showBranchControls ? (
              <div className="example-segment" role="tablist" aria-label="Component">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "player"}
                  data-active={mode === "player"}
                  onClick={() => {
                    setMode("player");
                    setHistory([]);
                  }}
                >
                  Player
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "scroller"}
                  data-active={mode === "scroller"}
                  onClick={() => {
                    setMode("scroller");
                    setHistory([]);
                  }}
                >
                  Scroller
                </button>
              </div>
            ) : null}

            {showBranchControls ? (
              <div className="example-preset-list" aria-label="Start path">
                {activeExample.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-active={preset.id === activePreset.id}
                    onClick={() => {
                      setPresetId(preset.id);
                      setHistory([]);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}

            {isMotionStory ? (
              <div className="example-preset-list" aria-label="Motion transition">
                {motionPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-active={preset.id === activeMotionPreset.id}
                    onClick={() => {
                      setPresetId(preset.id);
                      setHistory([]);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        <div className="example-main-grid">
          <div className="example-component-frame">
            {isMotionStory ? (
              <StoryScroller
                key={`motion-${activeMotionPreset.id}`}
                scenes={motionLabScenes}
                transition={activeMotionPreset.transition}
                ariaLabel="Motion examples"
                onActiveIndexChange={setScrollerActiveIndex}
                onSceneProgressChange={setSceneProgress}
              />
            ) : !isScrollerMode ? (
              <StoryPlayer
                key={`${activeExample.id}-${activePreset.id}`}
                story={activeExample.story}
                registry={storyRegistry}
                initialChoiceIds={activePreset.choiceIds}
                onPathChange={setHistory}
              />
            ) : (
              <StoryScroller
                key={`${activeExample.id}-${activePreset.id}`}
                story={activeExample.story}
                registry={storyRegistry}
                pathChoiceIds={activePreset.choiceIds}
                transition={{ type: "fade", scrollUnits: 16 }}
                onPathChange={setHistory}
                onActiveIndexChange={setScrollerActiveIndex}
                onSceneProgressChange={setSceneProgress}
              />
            )}
          </div>

          <aside className="example-inspector" aria-label="Story state">
            <StoryMinimap
              items={minimapItems}
              activeIndex={activeMinimapIndex}
              onSelect={isScrollerMode ? selectMinimapItem : undefined}
              collapsible
              className="example-minimap"
            />

            <div className="example-state-panel">
              <div>
                <p className="example-panel-label">
                  {isMotionStory
                    ? "Motion scene"
                    : isLinearStory
                      ? "Scroll sequence"
                      : mode === "player"
                        ? "Active path"
                        : "Start path"}
                </p>
                <h2>
                  {isMotionStory
                    ? (motionLabScenes[activeMinimapIndex]?.title ?? "Motion scenes")
                    : isLinearStory
                      ? "Story cards"
                      : activePreset.label}
                </h2>
              </div>
              <pre>
                {isMotionStory
                  ? getSceneSummary(motionLabScenes, activeMinimapIndex, sceneProgress)
                  : getHistorySummary(activeExample.story, visibleHistory)}
              </pre>
            </div>

            {showBranchControls ? (
              <div className="example-state-panel">
                <p className="example-panel-label">Choice ids</p>
                <code>{activePreset.choiceIds.join(" -> ") || "none"}</code>
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </main>
  );
}
