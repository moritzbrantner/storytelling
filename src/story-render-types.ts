import type { ComponentType, ReactNode } from "react";

import type {
  ResolvedStoryPath,
  StoryChoice,
  StoryContentBlock,
  StoryDocument,
  StoryHistoryEntry,
  StoryNode,
  StoryNodeData,
  StoryNodeTreeEntry,
  StoryState,
  StorySnapshot,
  StoryTimelineScene,
} from "./story-model";

export type StoryRenderProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  story: StoryDocument<TData, TState>;
  node: StoryNode<TData, TState>;
  nodeEntry?: StoryNodeTreeEntry<TData, TState>;
  history: StoryHistoryEntry<TData, TState>[];
  path: ResolvedStoryPath<TData, TState>;
  state: TState;
  snapshot: StorySnapshot<TData, TState>;
  currentIndex: number;
  progress: number;
  isEnding: boolean;
  canGoBack: boolean;
  choices: StoryChoice<TData, TState>[];
  visibleChoices: StoryChoice<TData, TState>[];
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
};

export type StoryStageComponent<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = ComponentType<StoryRenderProps<TData, TState>>;

export type StoryRemotionSceneProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryRenderProps<TData, TState> & {
  frame: number;
  absoluteFrame: number;
  durationInFrames: number;
  fps: number;
  sceneProgress: number;
  timelineScene: StoryTimelineScene<TData, TState>;
};

export type StoryRemotionSceneComponent<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = ComponentType<StoryRemotionSceneProps<TData, TState>>;

export type StoryThreeSceneProps<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = StoryRenderProps<TData, TState> & {
  stageProps?: Record<string, unknown>;
};

export type StoryThreeSceneComponent<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = ComponentType<StoryThreeSceneProps<TData, TState>>;

export type StoryRendererRegistry<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
> = {
  web?: Record<string, StoryStageComponent<TData, TState>>;
  remotion?: Record<string, StoryRemotionSceneComponent<TData, TState>>;
  three?: Record<string, StoryThreeSceneComponent<TData, TState>>;
};

export type StoryContentBlockMap = {
  [K in StoryContentBlock["type"]]: Extract<StoryContentBlock, { type: K }>;
};

export type StoryContentRendererFor<TBlock extends StoryContentBlock> = (props: {
  block: TBlock;
  index: number;
  content: StoryContentBlock[];
}) => ReactNode;

export type StoryContentRenderer = StoryContentRendererFor<StoryContentBlock>;

export type StoryContentRendererRegistry<
  TBlocks extends StoryContentBlockMap = StoryContentBlockMap,
> = {
  [K in keyof TBlocks]?: TBlocks[K] extends StoryContentBlock
    ? StoryContentRendererFor<TBlocks[K]>
    : never;
};

export type StoryContentRendererProps = {
  content?: StoryContentBlock[];
  renderBlock?: StoryContentRenderer;
  renderers?: StoryContentRendererRegistry;
  emptyContent?: ReactNode;
};
