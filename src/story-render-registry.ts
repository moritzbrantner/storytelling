import type { StoryNode, StoryNodeData, StoryVariables } from "./story-model";
import type { StoryRendererRegistry } from "./story-render-types";

export function createStoryRendererRegistry<
  TData extends StoryNodeData = StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(registry: StoryRendererRegistry<TData, TVars> = {}) {
  return registry;
}

export function getStoryRendererKey<
  TData extends StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(node: StoryNode<TData, TVars>) {
  return node.stage?.renderer ?? node.stage?.variant ?? "default";
}

export function getStoryStageProps<
  TData extends StoryNodeData,
  TVars extends StoryVariables = StoryVariables,
>(node: StoryNode<TData, TVars>) {
  return node.stage?.props ?? {};
}
