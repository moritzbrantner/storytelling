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
  StoryRuntimeState,
  StoryStateSnapshot,
  StoryTimelineScene,
  StoryVariables,
} from "./story-model";

export type StoryRenderProps<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  story: StoryDocument<TData, TVars>;
  node: StoryNode<TData, TVars>;
  nodeEntry?: StoryNodeTreeEntry<TData, TVars>;
  history: StoryHistoryEntry<TData, TVars>[];
  path: ResolvedStoryPath<TData, TVars>;
  state: StoryRuntimeState<TVars>;
  snapshot: StoryStateSnapshot<TData, TVars>;
  currentIndex: number;
  progress: number;
  isEnding: boolean;
  canGoBack: boolean;
  choices: StoryChoice<TData, TVars>[];
  visibleChoices: StoryChoice<TData, TVars>[];
  choose: (choiceId: string) => void;
  goBack: () => void;
  restart: () => void;
};

export type StoryStageComponent<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = ComponentType<StoryRenderProps<TData, TVars>>;

export type StoryRemotionSceneProps<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = StoryRenderProps<TData, TVars> & {
  frame: number;
  absoluteFrame: number;
  durationInFrames: number;
  fps: number;
  sceneProgress: number;
  timelineScene: StoryTimelineScene<TData, TVars>;
};

export type StoryRemotionSceneComponent<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = ComponentType<StoryRemotionSceneProps<TData, TVars>>;

export type StoryThreeSceneProps<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = StoryRenderProps<TData, TVars> & {
  stageProps?: Record<string, unknown>;
};

export type StoryThreeSceneComponent<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = ComponentType<StoryThreeSceneProps<TData, TVars>>;

export type StoryRendererRegistry<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
> = {
  web?: Record<string, StoryStageComponent<TData, TVars>>;
  remotion?: Record<string, StoryRemotionSceneComponent<TData, TVars>>;
  three?: Record<string, StoryThreeSceneComponent<TData, TVars>>;
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
