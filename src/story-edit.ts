import type { StoryChoice, StoryDocument, StoryNode, StoryNodeData } from "./story-model";
import { assertStoryDocument, type StoryValidationMode } from "./story-validation";

export type StoryPatch<TData extends StoryNodeData = StoryNodeData> =
  | { type: "set-story-fields"; fields: Partial<Omit<StoryDocument<TData>, "nodes">> }
  | { type: "add-node"; node: StoryNode<TData>; index?: number }
  | { type: "update-node"; nodeId: string; fields: Partial<StoryNode<TData>> }
  | { type: "rename-node"; nodeId: string; nextNodeId: string }
  | {
      type: "remove-node";
      nodeId: string;
      removeReferences?: boolean;
      nextOpeningNodeId?: string;
    }
  | { type: "add-choice"; nodeId: string; choice: StoryChoice; index?: number }
  | { type: "update-choice"; nodeId: string; choiceId: string; fields: Partial<StoryChoice> }
  | { type: "remove-choice"; nodeId: string; choiceId: string }
  | { type: "set-next"; nodeId: string; target?: string }
  | { type: "set-opening-node"; nodeId: string };

export type ApplyStoryPatchOptions = {
  validate?: boolean;
  validationMode?: StoryValidationMode;
  onMissing?: "throw" | "ignore";
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
  options: ApplyStoryPatchOptions,
): StoryDocument<TData> {
  let found = false;
  const nodes = story.nodes.map((node) => {
    if (node.id !== nodeId) {
      return node;
    }

    found = true;
    return updater(node);
  });

  if (!found && options.onMissing !== "ignore") {
    throw new Error(`Story "${story.id}" does not contain node "${nodeId}".`);
  }

  return {
    ...story,
    nodes,
  };
}

function assertChoiceExists<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  node: StoryNode<TData>,
  choiceId: string,
  options: ApplyStoryPatchOptions,
) {
  if (options.onMissing === "ignore") return;
  if (node.choices?.some((choice) => choice.id === choiceId)) return;

  throw new Error(
    `Story node "${node.id}" does not contain choice "${choiceId}" in "${story.id}".`,
  );
}

function updateChoiceTargets(choices: StoryChoice[] | undefined, from: string, to: string) {
  return choices?.map((choice) => ({
    ...choice,
    target: choice.target === from ? to : choice.target,
  }));
}

function applySingleStoryPatch<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  patch: StoryPatch<TData>,
  options: ApplyStoryPatchOptions,
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
    case "update-node": {
      if ("id" in patch.fields && patch.fields.id !== undefined) {
        throw new Error('Use the "rename-node" patch to change a story node id.');
      }

      return updateNode(
        story,
        patch.nodeId,
        (node) => ({
          ...node,
          ...patch.fields,
          id: node.id,
        }),
        options,
      );
    }
    case "rename-node": {
      const found = story.nodes.some((node) => node.id === patch.nodeId);
      if (!found) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      return {
        ...story,
        openingNodeId:
          story.openingNodeId === patch.nodeId ? patch.nextNodeId : story.openingNodeId,
        nodes: story.nodes.map((node) => ({
          ...node,
          id: node.id === patch.nodeId ? patch.nextNodeId : node.id,
          next: node.next === patch.nodeId ? patch.nextNodeId : node.next,
          choices: updateChoiceTargets(node.choices, patch.nodeId, patch.nextNodeId),
        })),
      };
    }
    case "remove-node": {
      const removeReferences = patch.removeReferences ?? true;
      const nodeExists = story.nodes.some((node) => node.id === patch.nodeId);
      if (!nodeExists) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      const remainingNodes = story.nodes.filter((node) => node.id !== patch.nodeId);
      if (
        story.openingNodeId === patch.nodeId &&
        remainingNodes.length > 0 &&
        !patch.nextOpeningNodeId
      ) {
        throw new Error(
          `Removing opening node "${patch.nodeId}" requires nextOpeningNodeId for story "${story.id}".`,
        );
      }

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
        openingNodeId:
          story.openingNodeId === patch.nodeId
            ? (patch.nextOpeningNodeId ?? "")
            : story.openingNodeId,
        nodes,
      };
    }
    case "add-choice":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const choices = [...(node.choices ?? [])];
          const index = clampInsertIndex(patch.index, choices.length);

          choices.splice(index, 0, patch.choice);

          return {
            ...node,
            next: undefined,
            choices,
          };
        },
        options,
      );
    case "update-choice":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          assertChoiceExists(story, node, patch.choiceId, options);

          return {
            ...node,
            choices: node.choices?.map((choice) =>
              choice.id === patch.choiceId ? { ...choice, ...patch.fields } : choice,
            ),
          };
        },
        options,
      );
    case "remove-choice":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          assertChoiceExists(story, node, patch.choiceId, options);
          const choices = node.choices?.filter((choice) => choice.id !== patch.choiceId);

          return {
            ...node,
            choices: choices && choices.length > 0 ? choices : undefined,
          };
        },
        options,
      );
    case "set-next":
      return updateNode(
        story,
        patch.nodeId,
        (node) => ({
          ...node,
          next: patch.target,
          choices: patch.target ? undefined : node.choices,
        }),
        options,
      );
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
  const resolvedOptions = { onMissing: "throw" as const, ...options };
  const patches = Array.isArray(patch) ? patch : [patch];
  const nextStory = patches.reduce(
    (currentStory, currentPatch) =>
      applySingleStoryPatch(currentStory, currentPatch, resolvedOptions),
    story,
  );

  return resolvedOptions.validate
    ? assertStoryDocument(nextStory, { mode: resolvedOptions.validationMode })
    : nextStory;
}
