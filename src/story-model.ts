export type StoryNodeData = Record<string, unknown>;

export type StoryVariableValue =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | Record<string, unknown>;

export type StoryVariables = Record<string, StoryVariableValue>;

export type StoryRuntimeState<TVars extends StoryVariables = StoryVariables> = {
  variables: TVars;
  score: number;
  inventory: string[];
  flags: Record<string, boolean>;
};

export type StoryStatePredicateContext<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  story: StoryDocument<TData, TVars>;
  node: StoryNode<TData, TVars>;
  choice?: StoryChoice<TData, TVars>;
  history: StoryHistoryEntry<TData, TVars>[];
  state: StoryRuntimeState<TVars>;
};

export type StoryStateReducerContext<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = StoryStatePredicateContext<TData, TVars> & {
  previousState: StoryRuntimeState<TVars>;
};

export type StoryStatePredicate<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  bivarianceHack(context: StoryStatePredicateContext<TData, TVars>): boolean;
}["bivarianceHack"];

export type StoryStateReducer<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  bivarianceHack(context: StoryStateReducerContext<TData, TVars>): StoryRuntimeState<TVars>;
}["bivarianceHack"];

export type StoryStateHooks<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  createInitialState?: {
    bivarianceHack(story: StoryDocument<TData, TVars>): StoryRuntimeState<TVars>;
  }["bivarianceHack"];
  canEnterNode?: StoryStatePredicate<TData, TVars>;
  isChoiceVisible?: StoryStatePredicate<TData, TVars>;
  isChoiceEnabled?: StoryStatePredicate<TData, TVars>;
  applyNode?: StoryStateReducer<TData, TVars>;
  applyChoice?: StoryStateReducer<TData, TVars>;
};

export type StoryMediaTextTrack = {
  src: string;
  label: string;
  srcLang?: string;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  default?: boolean;
};

export type StoryParagraphBlock = { type: "paragraph"; text: string };
export type StoryHeadingBlock = { type: "heading"; text: string; level?: 2 | 3 | 4 };
export type StoryQuoteBlock = { type: "quote"; text: string; cite?: string };
export type StoryListBlock = { type: "list"; items: string[] };
export type StoryImageBlock = { type: "image"; src: string; alt: string; caption?: string };
export type StoryAudioBlock = {
  type: "audio";
  src: string;
  title?: string;
  tracks?: StoryMediaTextTrack[];
};
export type StoryVideoBlock = {
  type: "video";
  src: string;
  title?: string;
  poster?: string;
  tracks?: StoryMediaTextTrack[];
};
export type StoryTableBlock = {
  type: "table";
  caption?: string;
  columns: Array<{ id: string; header: string; align?: "left" | "center" | "right" }>;
  rows: Array<Record<string, string | number | boolean | null>>;
};
export type StoryCodeBlock = {
  type: "code";
  code: string;
  language?: string;
  filename?: string;
  highlightedLines?: number[];
};
export type StoryChartBlock = {
  type: "chart";
  title?: string;
  description?: string;
  chartType: "bar" | "line" | "area" | "pie";
  data: Array<Record<string, string | number | null>>;
  xKey?: string;
  yKey?: string;
  series?: Array<{ key: string; label?: string; color?: string }>;
};
export type StoryEmbedBlock = {
  type: "embed";
  src: string;
  title: string;
  provider?: "iframe" | "youtube" | "vimeo" | "codepen" | "custom";
  aspectRatio?: "16:9" | "4:3" | "1:1" | "auto";
  allow?: string;
};
export type StoryCalloutBlock = {
  type: "callout";
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  title?: string;
  content: string;
};
export type StoryMarkdownBlock = { type: "markdown"; markdown: string };

export type StoryContentBlock =
  | StoryParagraphBlock
  | StoryHeadingBlock
  | StoryQuoteBlock
  | StoryListBlock
  | StoryImageBlock
  | StoryAudioBlock
  | StoryVideoBlock
  | StoryTableBlock
  | StoryCodeBlock
  | StoryChartBlock
  | StoryEmbedBlock
  | StoryCalloutBlock
  | StoryMarkdownBlock;

export type StoryChoice<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  id: string;
  label: string;
  target: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
  isVisible?: StoryStatePredicate<TData, TVars>;
  isEnabled?: StoryStatePredicate<TData, TVars>;
  reduceState?: StoryStateReducer<TData, TVars>;
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

export type StoryNode<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  id: string;
  title: string;
  eyebrow?: string;
  content?: StoryContentBlock[];
  prompt?: string;
  data?: TData;
  next?: string;
  choices?: StoryChoice<TData, TVars>[];
  children?: StoryNode<TData, TVars>[];
  durationInFrames?: number;
  scrollUnits?: number;
  transition?: StoryTransition;
  stage?: StoryStageDescriptor;
  canEnter?: StoryStatePredicate<TData, TVars>;
  reduceState?: StoryStateReducer<TData, TVars>;
};

export type StoryNodeTreeEntry<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  node: StoryNode<TData, TVars>;
  nodeId: string;
  parentNodeId?: string;
  ancestorNodeIds: string[];
  depth: number;
  index: number;
  indexPath: number[];
  path: string;
};

export type StoryDocument<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  openingNodeId: string;
  nodes: StoryNode<TData, TVars>[];
  defaults?: StoryDefaults;
  labels?: StoryLabels;
  initialState?: StoryRuntimeState<TVars>;
};

export type StoryHistoryEntry<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  nodeId: string;
  choiceId?: string;
  data?: TData;
  state?: StoryRuntimeState<TVars>;
};

export type StoryStateSnapshot<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  nodeId: string;
  history: StoryHistoryEntry<TData, TVars>[];
  state: StoryRuntimeState<TVars>;
  stoppedReason?: ResolvedStoryPath<TData, TVars>["stoppedReason"];
};

export type ResolvedStoryPath<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  nodes: StoryNode<TData, TVars>[];
  history: StoryHistoryEntry<TData, TVars>[];
  currentNode: StoryNode<TData, TVars>;
  completed: boolean;
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
  stoppedAt?: string;
  consumedChoiceIds?: string[];
  unconsumedChoiceIds?: string[];
  stoppedReason?:
    | "ending"
    | "awaiting-choice"
    | "invalid-choice"
    | "blocked-by-condition"
    | "stop-at"
    | "max-steps";
};

export type StoryTimelineScene<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  node: StoryNode<TData, TVars>;
  nodeEntry?: StoryNodeTreeEntry<TData, TVars>;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  transitionInFrames: number;
  pathIndex: number;
  history: StoryHistoryEntry<TData, TVars>[];
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
};

export type StoryTimeline<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  scenes: StoryTimelineScene<TData, TVars>[];
  totalFrames: number;
  fps: number;
  history: StoryHistoryEntry<TData, TVars>[];
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
};
