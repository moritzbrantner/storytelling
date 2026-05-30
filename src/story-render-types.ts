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
  StoryTimelineScene,
} from "./story-model";

export type StoryRenderProps<TData extends StoryNodeData = StoryNodeData> = {
  story: StoryDocument<TData>;
  node: StoryNode<TData>;
  nodeEntry?: StoryNodeTreeEntry<TData>;
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

export type StoryContentRenderer = (props: {
  block: StoryContentBlock;
  index: number;
  content: StoryContentBlock[];
}) => ReactNode;

export type StoryContentRendererRegistry = Record<string, StoryContentRenderer>;

export type StoryContentRendererProps = {
  content?: StoryContentBlock[];
  renderBlock?: StoryContentRenderer;
  renderers?: StoryContentRendererRegistry;
  emptyContent?: ReactNode;
};
