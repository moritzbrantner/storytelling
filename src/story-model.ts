export type StoryJsonPrimitive = string | number | boolean | null;
export type StoryJsonValue = StoryJsonPrimitive | StoryJsonValue[] | StoryJsonObject;
export type StoryJsonObject = { [key: string]: StoryJsonValue };
export type StoryNodeData = StoryJsonObject;
export type StoryState = StoryJsonObject;

export type StoryStatePredicateContext<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  story: StoryDocument<TData, TState>;
  node: StoryNode<TData, TState>;
  choice?: StoryChoice<TData, TState>;
  history: StoryHistoryEntry<TData, TState>[];
  state: TState;
};

export type StoryStateReducerContext<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryStatePredicateContext<TData, TState> & {
  previousState: TState;
};

export type StoryStatePredicate<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  bivarianceHack(context: StoryStatePredicateContext<TData, TState>): boolean;
}["bivarianceHack"];

export type StoryStateReducer<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  bivarianceHack(context: StoryStateReducerContext<TData, TState>): TState;
}["bivarianceHack"];

export type StoryStateHooks<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  createInitialState?: {
    bivarianceHack(story: StoryDocument<TData, TState>): TState;
  }["bivarianceHack"];
  canEnterNode?: StoryStatePredicate<TData, TState>;
  isChoiceVisible?: StoryStatePredicate<TData, TState>;
  isChoiceEnabled?: StoryStatePredicate<TData, TState>;
  applyNode?: StoryStateReducer<TData, TState>;
  applyChoice?: StoryStateReducer<TData, TState>;
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
  _TData extends StoryNodeData = StoryNodeData,
  _TState extends StoryState = StoryState,
> = {
  id: string;
  label: string;
  target: string;
  description?: string;
  disabled?: boolean;
  hidden?: boolean;
};

export type StoryTransition = {
  type?: "fade" | "slide" | "scale" | "none";
  durationInFrames?: number;
  reducedMotion?: boolean;
};

export type StoryStageDescriptor = {
  renderer?: string;
  variant?: "default" | "media" | "fullscreen" | "split";
  props?: StoryJsonObject;
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
  TState extends StoryState = StoryState,
> = {
  id: string;
  title: string;
  eyebrow?: string;
  content?: StoryContentBlock[];
  prompt?: string;
  data?: TData;
  next?: string;
  choices?: StoryChoice<TData, TState>[];
  children?: StoryNode<TData, TState>[];
  durationInFrames?: number;
  scrollUnits?: number;
  transition?: StoryTransition;
  stage?: StoryStageDescriptor;
};

export type StoryNodeTreeEntry<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  node: StoryNode<TData, TState>;
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
  TState extends StoryState = StoryState,
> = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  openingNodeId: string;
  nodes: StoryNode<TData, TState>[];
  defaults?: StoryDefaults;
  labels?: StoryLabels;
  initialState?: TState;
};

export type StoryDraftNode<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = Partial<Omit<StoryNode<TData, TState>, "children">> & {
  children?: StoryDraftNode<TData, TState>[];
};

export type StoryDraft<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = Partial<Omit<StoryDocument<TData, TState>, "nodes">> & {
  nodes?: StoryDraftNode<TData, TState>[];
};

export type StoryHistoryEntry<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  nodeId: string;
  choiceId?: string;
  data?: TData;
  state?: TState;
};

export type StorySnapshot<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  nodeId: string;
  history: StoryHistoryEntry<TData, TState>[];
  state: TState;
  stoppedReason?: ResolvedStoryPath<TData, TState>["stoppedReason"];
};

export type ResolvedStoryPath<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  nodes: StoryNode<TData, TState>[];
  history: StoryHistoryEntry<TData, TState>[];
  currentNode: StoryNode<TData, TState>;
  completed: boolean;
  state: TState;
  snapshot: StorySnapshot<TData, TState>;
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
  TState extends StoryState = StoryState,
> = {
  node: StoryNode<TData, TState>;
  nodeEntry?: StoryNodeTreeEntry<TData, TState>;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  transitionInFrames: number;
  pathIndex: number;
  history: StoryHistoryEntry<TData, TState>[];
  state: TState;
  snapshot: StorySnapshot<TData, TState>;
};

export type StoryTimeline<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  scenes: StoryTimelineScene<TData, TState>[];
  totalFrames: number;
  fps: number;
  history: StoryHistoryEntry<TData, TState>[];
  state: TState;
  snapshot: StorySnapshot<TData, TState>;
};
