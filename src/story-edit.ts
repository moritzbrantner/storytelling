import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import { assertStoryDocument } from "./story-validation";

export type StoryPatch<TData extends StoryNodeData = StoryNodeData> =
  | { type: "set-story-fields"; fields: Partial<Omit<StoryDocument<TData>, "nodes">> }
  | { type: "add-node"; node: StoryNode<TData>; index?: number }
  | { type: "update-node"; nodeId: string; fields: Partial<StoryNode<TData>> }
  | { type: "remove-node"; nodeId: string; removeReferences?: boolean }
  | { type: "add-choice"; nodeId: string; choice: StoryChoice; index?: number }
  | { type: "update-choice"; nodeId: string; choiceId: string; fields: Partial<StoryChoice> }
  | { type: "remove-choice"; nodeId: string; choiceId: string }
  | { type: "set-next"; nodeId: string; target?: string }
  | { type: "set-opening-node"; nodeId: string };

export type ApplyStoryPatchOptions = {
  validate?: boolean;
};

export function createStoryNode<TData extends StoryNodeData = StoryNodeData>(
  input: Pick<StoryNode<TData>, "id" | "title"> & Partial<StoryNode<TData>>,
): StoryNode<TData> {
  return { ...input };
}

function clampInsertIndex(index: number | undefined, length: number) {
  if (index === undefined || !Number.isFinite(index)) {
    return length;
  }

  return Math.min(Math.max(Math.floor(index), 0), length);
}

function updateNode<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  nodeId: string,
  updater: (node: StoryNode<TData>) => StoryNode<TData>,
): StoryDocument<TData> {
  return {
    ...story,
    nodes: story.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
  };
}

function applySingleStoryPatch<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  patch: StoryPatch<TData>,
): StoryDocument<TData> {
  switch (patch.type) {
    case "set-story-fields":
      return {
        ...story,
        ...patch.fields,
        nodes: story.nodes,
      };
    case "add-node": {
      const index = clampInsertIndex(patch.index, story.nodes.length);
      return {
        ...story,
        nodes: [...story.nodes.slice(0, index), patch.node, ...story.nodes.slice(index)],
      };
    }
    case "update-node":
      return updateNode(story, patch.nodeId, (node) => ({
        ...node,
        ...patch.fields,
        id: patch.fields.id ?? node.id,
      }));
    case "remove-node": {
      const removeReferences = patch.removeReferences ?? true;
      const nodes: StoryNode<TData>[] = [];

      for (const node of story.nodes) {
        if (node.id === patch.nodeId) {
          continue;
        }

        if (!removeReferences) {
          nodes.push(node);
          continue;
        }

        const next = node.next === patch.nodeId ? undefined : node.next;
        const choices = node.choices?.filter((choice) => choice.target !== patch.nodeId);

        nodes.push({
          ...node,
          next,
          choices: choices && choices.length > 0 ? choices : undefined,
        });
      }

      return {
        ...story,
        nodes,
      };
    }
    case "add-choice":
      return updateNode(story, patch.nodeId, (node) => {
        const choices = [...(node.choices ?? [])];
        const index = clampInsertIndex(patch.index, choices.length);

        choices.splice(index, 0, patch.choice);

        return {
          ...node,
          next: undefined,
          choices,
        };
      });
    case "update-choice":
      return updateNode(story, patch.nodeId, (node) => ({
        ...node,
        choices: node.choices?.map((choice) =>
          choice.id === patch.choiceId ? { ...choice, ...patch.fields } : choice,
        ),
      }));
    case "remove-choice":
      return updateNode(story, patch.nodeId, (node) => {
        const choices = node.choices?.filter((choice) => choice.id !== patch.choiceId);

        return {
          ...node,
          choices: choices && choices.length > 0 ? choices : undefined,
        };
      });
    case "set-next":
      return updateNode(story, patch.nodeId, (node) => ({
        ...node,
        next: patch.target,
        choices: patch.target ? undefined : node.choices,
      }));
    case "set-opening-node":
      return {
        ...story,
        openingNodeId: patch.nodeId,
      };
    default:
      return story;
  }
}

export function applyStoryPatch<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  patch: StoryPatch<TData> | StoryPatch<TData>[],
  options: ApplyStoryPatchOptions = {},
): StoryDocument<TData> {
  const patches = Array.isArray(patch) ? patch : [patch];
  const nextStory = patches.reduce(
    (currentStory, currentPatch) => applySingleStoryPatch(currentStory, currentPatch),
    story,
  );

  return options.validate ? assertStoryDocument(nextStory) : nextStory;
}
