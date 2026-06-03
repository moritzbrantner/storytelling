import type {
  StoryDocument,
  StoryHistoryEntry,
  StoryScrollAutoplay,
  StoryScrollScene,
  StoryScrollTransition,
} from "@moritzbrantner/storytelling";

import {
  extendedRelayStory,
  linearStory,
  signalStory,
  type MotionLabSceneData,
  type SignalStoryData,
} from "./story";

export type ExampleMode = "player" | "scroller";
export type ExamplePage = "lab" | "creator";
export type ExampleStoryId =
  | "branching"
  | "branching-deep"
  | "linear"
  | "motion"
  | "autoscroll"
  | "authoring";

export type PathPreset = {
  id: string;
  label: string;
  choiceIds: string[];
};

export type ExampleStory = {
  id: Exclude<ExampleStoryId, "motion">;
  label: string;
  story: StoryDocument<SignalStoryData>;
  presets: PathPreset[];
};

export type MotionPreset = {
  id: string;
  label: string;
  transition: StoryScrollTransition;
};

export type AutoscrollPreset = {
  id: string;
  label: string;
  description: string;
  autoplay: StoryScrollAutoplay;
  transition: StoryScrollTransition;
  scrollInputScale: number;
};

export type ExampleCatalog = {
  storyOptions: { id: ExampleStoryId; label: string }[];
  stories: ExampleStory[];
  motionPresets: MotionPreset[];
  autoscrollPresets: AutoscrollPreset[];
};

export const exampleCatalog: ExampleCatalog = {
  storyOptions: [
    { id: "branching", label: "Branching" },
    { id: "branching-deep", label: "Branching (Deep)" },
    { id: "linear", label: "Linear" },
    { id: "motion", label: "Motion" },
    { id: "autoscroll", label: "Autoscroll" },
    { id: "authoring", label: "Authoring" },
  ],
  stories: [
    {
      id: "branching",
      label: "Branching",
      story: signalStory,
      presets: [
        { id: "opening", label: "Opening", choiceIds: [] },
        { id: "pilot", label: "Pilot route", choiceIds: ["answer"] },
        { id: "trace", label: "Harbor choice", choiceIds: ["trace"] },
        { id: "harbor-team", label: "Harbor team", choiceIds: ["trace", "send-team"] },
        { id: "harbor-broadcast", label: "Broadcast fix", choiceIds: ["trace", "broadcast"] },
        { id: "archive", label: "Archive route", choiceIds: ["archive"] },
      ],
    },
    {
      id: "branching-deep",
      label: "Branching (Deep)",
      story: extendedRelayStory,
      presets: [
        { id: "opening", label: "Opening", choiceIds: [] },
        { id: "pilot-route", label: "Pilot route", choiceIds: ["answer-pilot"] },
        {
          id: "pilot-route_stabilize",
          label: "Pilot route (stabilize)",
          choiceIds: ["answer-pilot", "stabilize-route"],
        },
        { id: "harbor-team", label: "Harbor team", choiceIds: ["trace-source", "send-team"] },
        {
          id: "archive-verify",
          label: "Archive verify",
          choiceIds: ["archive-review", "verify-archive"],
        },
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
  ],
  motionPresets: [
    { id: "soft-fade", label: "Fade", transition: { type: "fade", scrollUnits: 18 } },
    {
      id: "slide-up",
      label: "Slide",
      transition: { type: "slide", scrollUnits: 22, direction: "up" },
    },
    {
      id: "push-left",
      label: "Push",
      transition: { type: "push", scrollUnits: 24, direction: "left" },
    },
    {
      id: "wipe-right",
      label: "Wipe",
      transition: { type: "wipe", scrollUnits: 24, direction: "right" },
    },
    { id: "zoom", label: "Zoom", transition: { type: "zoom", scrollUnits: 24 } },
    { id: "blur", label: "Blur", transition: { type: "blur", scrollUnits: 22 } },
    { id: "direct", label: "Direct", transition: { type: "none" } },
  ],
  autoscrollPresets: [
    {
      id: "reading",
      label: "Reading pace",
      description: "Autoscrolls at a measured pace with a short crossfade between panels.",
      autoplay: { unitsPerSecond: 12 },
      transition: { type: "fade", scrollUnits: 14 },
      scrollInputScale: 0.5,
    },
    {
      id: "tour",
      label: "Guided tour",
      description: "Uses the default autoplay pace with a pushed visual handoff.",
      autoplay: true,
      transition: { type: "push", scrollUnits: 26, direction: "up" },
      scrollInputScale: 0.75,
    },
    {
      id: "scan",
      label: "Fast scan",
      description: "Moves quickly through scenes while keeping manual wheel input responsive.",
      autoplay: { unitsPerSecond: 34 },
      transition: { type: "none" },
      scrollInputScale: 1.25,
    },
  ],
};

export async function getExampleCatalog() {
  return exampleCatalog;
}

export function getDefaultPresetId(storyId: ExampleStoryId, catalog: ExampleCatalog) {
  if (storyId === "motion") {
    return catalog.motionPresets[0]?.id ?? "soft-fade";
  }

  if (storyId === "autoscroll") {
    return catalog.autoscrollPresets[0]?.id ?? "reading";
  }

  return catalog.stories.find((example) => example.id === storyId)?.presets[0]?.id ?? "opening";
}

export const storyOptionsFallback: { id: ExampleStoryId; label: string }[] = [
  { id: "branching", label: "Branching" },
  { id: "branching-deep", label: "Branching (Deep)" },
  { id: "linear", label: "Linear" },
  { id: "motion", label: "Motion" },
  { id: "autoscroll", label: "Autoscroll" },
  { id: "authoring", label: "Authoring" },
];

export function getStoryScrollerPageId(storyId: string, nodeId: string) {
  return `story-scroller-page-${storyId}-${nodeId}`;
}

export function getHistorySummary(
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

export function getSceneSummary(
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

export function getAutoscrollPaceLabel(autoplay: StoryScrollAutoplay) {
  if (autoplay === true) {
    return "20 units/s";
  }

  if (!autoplay || autoplay.enabled === false) {
    return "Off";
  }

  return `${autoplay.unitsPerSecond ?? 20} units/s`;
}

export function getTransitionSummary(transition: StoryScrollTransition) {
  if (transition.type === "none") {
    return "direct";
  }

  return `${transition.scrollUnits} units ${transition.type}`;
}
