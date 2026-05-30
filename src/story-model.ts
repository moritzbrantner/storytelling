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
  children?: StoryNode<TData>[];
  durationInFrames?: number;
  scrollUnits?: number;
  transition?: StoryTransition;
  stage?: StoryStageDescriptor;
};

export type StoryNodeTreeEntry<TData extends StoryNodeData = StoryNodeData> = {
  node: StoryNode<TData>;
  nodeId: string;
  parentNodeId?: string;
  ancestorNodeIds: string[];
  depth: number;
  index: number;
  indexPath: number[];
  path: string;
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
  consumedChoiceIds?: string[];
  unconsumedChoiceIds?: string[];
  stoppedReason?: "ending" | "awaiting-choice" | "invalid-choice" | "stop-at" | "max-steps";
};

export type StoryTimelineScene<TData extends StoryNodeData = StoryNodeData> = {
  node: StoryNode<TData>;
  nodeEntry?: StoryNodeTreeEntry<TData>;
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
