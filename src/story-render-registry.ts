import type { StoryNode, StoryNodeData } from "./story-model";
import type { StoryRendererRegistry } from "./story-render-types";

export function createStoryRendererRegistry<TData extends StoryNodeData = StoryNodeData>(
  registry: StoryRendererRegistry<TData> = {},
) {
  return registry;
}

export function getStoryRendererKey<TData extends StoryNodeData>(node: StoryNode<TData>) {
  return node.stage?.renderer ?? node.stage?.variant ?? "default";
}

export function getStoryStageProps<TData extends StoryNodeData>(node: StoryNode<TData>) {
  return node.stage?.props ?? {};
}
