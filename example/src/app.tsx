import { useEffect, useMemo, useState } from "react";

import {
  StoryMinimap,
  StoryPlayer,
  StoryScroller,
  resolveStoryPath,
  type StoryDocument,
  type StoryHistoryEntry,
} from "@moritzbrantner/storytelling";

import { linearStory, signalStory, storyRegistry, type SignalStoryData } from "./story";

type ExampleMode = "player" | "scroller";
type ExampleStoryId = "branching" | "linear";

type PathPreset = {
  id: string;
  label: string;
  choiceIds: string[];
};

type ExampleStory = {
  id: ExampleStoryId;
  label: string;
  story: StoryDocument<SignalStoryData>;
  presets: PathPreset[];
};

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

export function ExampleApp() {
  const [storyId, setStoryId] = useState<ExampleStoryId>("branching");
  const [mode, setMode] = useState<ExampleMode>("player");
  const [scrollerActiveIndex, setScrollerActiveIndex] = useState(0);
  const activeExample =
    exampleStories.find((example) => example.id === storyId) ?? exampleStories[0]!;
  const [presetId, setPresetId] = useState(activeExample.presets[0]?.id ?? "opening");
  const [history, setHistory] = useState<StoryHistoryEntry<SignalStoryData>[]>([]);
  const activePreset =
    activeExample.presets.find((preset) => preset.id === presetId) ?? activeExample.presets[0]!;
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
  const isLinearStory = activeExample.id === "linear";
  const isScrollerMode = isLinearStory || mode === "scroller";
  const visibleHistory = isLinearStory
    ? linearScrollPath.history
    : history.length > 0
      ? history
      : presetPath.history;
  const activeMinimapIndex = isScrollerMode
    ? scrollerActiveIndex
    : Math.max(visibleHistory.length - 1, 0);
  const showBranchControls = !isLinearStory;
  const minimapItems = visibleHistory.map((entry) => {
    const node = activeExample.story.nodes.find((candidate) => candidate.id === entry.nodeId);

    return {
      id: entry.nodeId,
      title: node?.title ?? entry.nodeId,
      eyebrow: node?.eyebrow,
    };
  });

  useEffect(() => {
    setScrollerActiveIndex(0);
  }, [activeExample.id, activePreset.id, mode]);

  useEffect(() => {
    if (activeExample.id === "linear" && mode !== "scroller") {
      setMode("scroller");
    }
  }, [activeExample.id, mode]);

  const selectMinimapItem = (index: number) => {
    if (!isScrollerMode) return;

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
              {exampleStories.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  role="tab"
                  aria-selected={storyId === example.id}
                  data-active={storyId === example.id}
                  onClick={() => {
                    setStoryId(example.id);
                    setPresetId(example.presets[0]?.id ?? "opening");
                    if (example.id === "linear") {
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
          </div>
        </header>

        <div className="example-main-grid">
          <div className="example-component-frame">
            {!isScrollerMode ? (
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
                onPathChange={setHistory}
                onActiveIndexChange={setScrollerActiveIndex}
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
                  {isLinearStory
                    ? "Scroll sequence"
                    : mode === "player"
                      ? "Active path"
                      : "Start path"}
                </p>
                <h2>{isLinearStory ? "Story cards" : activePreset.label}</h2>
              </div>
              <pre>{getHistorySummary(activeExample.story, visibleHistory)}</pre>
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
