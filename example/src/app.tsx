import { useMemo, useState } from "react";

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
  const visibleHistory = mode === "player" && history.length > 0 ? history : presetPath.history;
  const minimapItems = visibleHistory.map((entry) => {
    const node = activeExample.story.nodes.find((candidate) => candidate.id === entry.nodeId);

    return {
      id: entry.nodeId,
      title: node?.title ?? entry.nodeId,
      eyebrow: node?.eyebrow,
    };
  });

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
                    setHistory([]);
                  }}
                >
                  {example.label}
                </button>
              ))}
            </div>

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
          </div>
        </header>

        <div className="example-main-grid">
          <div className="example-component-frame">
            {mode === "player" ? (
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
              />
            )}
          </div>

          <aside className="example-inspector" aria-label="Story state">
            <StoryMinimap
              items={minimapItems}
              activeIndex={Math.max(visibleHistory.length - 1, 0)}
              className="example-minimap"
            />

            <div className="example-state-panel">
              <div>
                <p className="example-panel-label">
                  {mode === "player" ? "Active path" : "Start path"}
                </p>
                <h2>{activePreset.label}</h2>
              </div>
              <pre>{getHistorySummary(activeExample.story, visibleHistory)}</pre>
            </div>

            <div className="example-state-panel">
              <p className="example-panel-label">Choice ids</p>
              <code>{activePreset.choiceIds.join(" -> ") || "none"}</code>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
