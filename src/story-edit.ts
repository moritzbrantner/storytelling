import type {
  StoryChoice,
  StoryContentBlock,
  StoryDocument,
  StoryNode,
  StoryNodeData,
} from "./story-model";
import { assertStoryDocument, type StoryValidationMode } from "./story-validation";

export type StoryPatch<TData extends StoryNodeData = StoryNodeData> =
  | { type: "set-story-fields"; fields: Partial<Omit<StoryDocument<TData>, "nodes">> }
  | { type: "add-node"; node: StoryNode<TData>; index?: number }
  | { type: "move-node"; nodeId: string; index: number }
  | { type: "update-node"; nodeId: string; fields: Partial<StoryNode<TData>> }
  | { type: "rename-node"; nodeId: string; nextNodeId: string }
  | {
      type: "remove-node";
      nodeId: string;
      removeReferences?: boolean;
      nextOpeningNodeId?: string;
    }
  | { type: "add-choice"; nodeId: string; choice: StoryChoice; index?: number }
  | { type: "move-choice"; nodeId: string; choiceId: string; index: number }
  | { type: "update-choice"; nodeId: string; choiceId: string; fields: Partial<StoryChoice> }
  | { type: "remove-choice"; nodeId: string; choiceId: string }
  | { type: "add-content-block"; nodeId: string; block: StoryContentBlock; index?: number }
  | { type: "update-content-block"; nodeId: string; index: number; block: StoryContentBlock }
  | { type: "remove-content-block"; nodeId: string; index: number }
  | { type: "move-content-block"; nodeId: string; fromIndex: number; toIndex: number }
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

function assertItemIndex(index: number, length: number, label: string) {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new Error(`${label} index ${index} is out of range.`);
  }
}

function assertMoveTargetIndex(index: number, length: number, label: string) {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new Error(`${label} move target index ${index} is out of range.`);
  }
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);

  nextItems.splice(toIndex, 0, item!);

  return nextItems;
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
    case "move-node": {
      const currentIndex = story.nodes.findIndex((node) => node.id === patch.nodeId);
      if (currentIndex < 0) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      assertMoveTargetIndex(patch.index, story.nodes.length, "Story node");

      return {
        ...story,
        nodes: moveArrayItem(story.nodes, currentIndex, patch.index),
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
    case "move-choice":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const choices = node.choices ?? [];
          const currentIndex = choices.findIndex((choice) => choice.id === patch.choiceId);

          if (currentIndex < 0) {
            assertChoiceExists(story, node, patch.choiceId, options);
            return node;
          }

          assertMoveTargetIndex(patch.index, choices.length, "Story choice");

          return {
            ...node,
            choices: moveArrayItem(choices, currentIndex, patch.index),
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
    case "add-content-block":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const content = [...(node.content ?? [])];
          const index = clampInsertIndex(patch.index, content.length);

          content.splice(index, 0, patch.block);

          return {
            ...node,
            content,
          };
        },
        options,
      );
    case "update-content-block":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const content = node.content ?? [];
          assertItemIndex(patch.index, content.length, "Story content block");

          return {
            ...node,
            content: content.map((block, index) => (index === patch.index ? patch.block : block)),
          };
        },
        options,
      );
    case "remove-content-block":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const content = node.content ?? [];
          assertItemIndex(patch.index, content.length, "Story content block");
          const nextContent = content.filter((_, index) => index !== patch.index);

          return {
            ...node,
            content: nextContent.length > 0 ? nextContent : undefined,
          };
        },
        options,
      );
    case "move-content-block":
      return updateNode(
        story,
        patch.nodeId,
        (node) => {
          const content = node.content ?? [];
          assertItemIndex(patch.fromIndex, content.length, "Story content block");
          assertMoveTargetIndex(patch.toIndex, content.length, "Story content block");

          return {
            ...node,
            content: moveArrayItem(content, patch.fromIndex, patch.toIndex),
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
