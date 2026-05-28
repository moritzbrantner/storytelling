import type { ComponentType, ReactNode } from "react";

export type StoryNodeData = Record<string, unknown>;

export type StoryMediaTextTrack = {
  src: string;
  label: string;
  srcLang?: string;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  default?: boolean;
};

export type StoryContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level?: 2 | 3 | 4 }
  | { type: "quote"; text: string; cite?: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "audio"; src: string; title?: string; tracks?: StoryMediaTextTrack[] }
  | {
      type: "video";
      src: string;
      title?: string;
      poster?: string;
      tracks?: StoryMediaTextTrack[];
    };

export type StoryChoice = {
  id: string;
  label: string;
  target: string;
  description?: string;
  disabled?: boolean;
};

export type StoryTransition = {
  type?: "fade" | "slide" | "scale" | "none";
  durationInFrames?: number;
  reducedMotion?: boolean;
};

export type StoryStageDescriptor = {
  renderer?: string;
  variant?: "default" | "media" | "fullscreen" | "split";
  props?: Record<string, unknown>;
};

export type StoryDefaults = {
  durationInFrames?: number;
  transitionInFrames?: number;
  stage?: StoryStageDescriptor;
};

export type StoryLabels = {
  back?: string;
  restart?: string;
  continue?: string;
  choosePrompt?: string;
  endingPrompt?: string;
  completedBranch?: string;
  scrollerLabel?: string;
  minimapLabel?: string;
};

export type StoryNode<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  title: string;
  eyebrow?: string;
  content?: StoryContentBlock[];
  prompt?: string;
  data?: TData;
  next?: string;
  choices?: StoryChoice[];
  durationInFrames?: number;
  scrollUnits?: number;
  transition?: StoryTransition;
  stage?: StoryStageDescriptor;
};

export type StoryDocument<TData extends StoryNodeData = StoryNodeData> = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  openingNodeId: string;
  nodes: StoryNode<TData>[];
  defaults?: StoryDefaults;
  labels?: StoryLabels;
};

export type StoryHistoryEntry<TData extends StoryNodeData = StoryNodeData> = {
  nodeId: string;
  choiceId?: string;
  data?: TData;
};

export type ResolvedStoryPath<TData extends StoryNodeData = StoryNodeData> = {
  nodes: StoryNode<TData>[];
  history: StoryHistoryEntry<TData>[];
  currentNode: StoryNode<TData>;
  completed: boolean;
  stoppedAt?: string;
};

export type StoryTimelineScene<TData extends StoryNodeData = StoryNodeData> = {
  node: StoryNode<TData>;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  transitionInFrames: number;
  pathIndex: number;
  history: StoryHistoryEntry<TData>[];
};

export type StoryTimeline<TData extends StoryNodeData = StoryNodeData> = {
  scenes: StoryTimelineScene<TData>[];
  totalFrames: number;
  fps: number;
  history: StoryHistoryEntry<TData>[];
};

export type StoryRenderProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  node: StoryNode<TData>;
  history: StoryHistoryEntry<TData>[];
  path: ResolvedStoryPath<TData>;
  currentIndex: number;
  progress: number;
  isEnding: boolean;
  canGoBack: boolean;
  choices: StoryChoice[];
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
};

export type StoryStageComponent<TData extends StoryNodeData = StoryNodeData> = ComponentType<
  StoryRenderProps<TData>
>;

export type StoryRemotionSceneProps<TData extends StoryNodeData = StoryNodeData> =
  StoryRenderProps<TData> & {
    frame: number;
    absoluteFrame: number;
    durationInFrames: number;
    fps: number;
    sceneProgress: number;
    timelineScene: StoryTimelineScene<TData>;
  };

export type StoryRemotionSceneComponent<TData extends StoryNodeData = StoryNodeData> =
  ComponentType<StoryRemotionSceneProps<TData>>;

export type StoryThreeSceneProps<TData extends StoryNodeData = StoryNodeData> =
  StoryRenderProps<TData> & {
    stageProps?: Record<string, unknown>;
  };

export type StoryThreeSceneComponent<TData extends StoryNodeData = StoryNodeData> = ComponentType<
  StoryThreeSceneProps<TData>
>;

export type StoryRendererRegistry<TData extends StoryNodeData = StoryNodeData> = {
  web?: Record<string, StoryStageComponent<TData>>;
  remotion?: Record<string, StoryRemotionSceneComponent<TData>>;
  three?: Record<string, StoryThreeSceneComponent<TData>>;
};

export type StoryContentRendererProps = {
  content?: StoryContentBlock[];
  emptyContent?: ReactNode;
};
