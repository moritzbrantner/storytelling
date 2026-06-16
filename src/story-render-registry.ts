import type { StoryNode, StoryNodeData, StoryState } from "./story-model";
import type { StoryRendererRegistry } from "./story-render-types";

export function createStoryRendererRegistry<
  TData extends StoryNodeData = StoryNodeData,
  TState extends StoryState = StoryState,
>(registry: StoryRendererRegistry<TData, TState> = {}) {
  return registry;
}

export function getStoryRendererKey<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(node: StoryNode<TData, TState>) {
  return node.stage?.renderer ?? node.stage?.variant ?? "default";
}

export function getStoryStageProps<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(node: StoryNode<TData, TState>) {
  return node.stage?.props ?? {};
}
