import type {
  StoryChoice,
  StoryContentBlock,
  StoryDocument,
  StoryNode,
  StoryNodeData,
} from "./story-model";
import { getStoryNodeEntries, getStoryNodes } from "./story-node-tree";
import { assertStoryDocument, type StoryValidationMode } from "./story-validation";

export type StoryPatch<TData extends StoryNodeData = StoryNodeData> =
  | { type: "set-story-fields"; fields: Partial<Omit<StoryDocument<TData>, "nodes">> }
  | { type: "add-node"; node: StoryNode<TData>; index?: number; parentNodeId?: string }
  | { type: "move-node"; nodeId: string; index: number; parentNodeId?: string }
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

function updateNodeList<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  nodeId: string,
  updater: (node: StoryNode<TData>) => StoryNode<TData>,
): { nodes: StoryNode<TData>[]; found: boolean } {
  let found = false;

  const nextNodes: StoryNode<TData>[] = nodes.map((node) => {
    if (node.id !== nodeId) {
      const nextChildren: { nodes: StoryNode<TData>[]; found: boolean } | undefined = node.children
        ? updateNodeList(node.children, nodeId, updater)
        : undefined;

      if (nextChildren?.found) {
        found = true;
        return {
          ...node,
          children: nextChildren.nodes,
        };
      }

      return node;
    }

    found = true;
    return updater(node);
  });

  return { nodes: nextNodes, found };
}

function updateNode<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  nodeId: string,
  updater: (node: StoryNode<TData>) => StoryNode<TData>,
  options: ApplyStoryPatchOptions,
): StoryDocument<TData> {
  const result = updateNodeList(story.nodes, nodeId, updater);

  if (!result.found && options.onMissing !== "ignore") {
    throw new Error(`Story "${story.id}" does not contain node "${nodeId}".`);
  }

  return {
    ...story,
    nodes: result.nodes,
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

function getNodeAndDescendantIds<TData extends StoryNodeData>(node: StoryNode<TData>) {
  const ids = [node.id];

  for (const child of node.children ?? []) {
    ids.push(...getNodeAndDescendantIds(child));
  }

  return ids;
}

function mapNodeTree<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  mapper: (node: StoryNode<TData>) => StoryNode<TData> | undefined,
): StoryNode<TData>[] {
  return nodes.flatMap((node) => {
    const mappedChildren = node.children ? mapNodeTree(node.children, mapper) : undefined;
    const mappedNode = mapper({
      ...node,
      children: mappedChildren && mappedChildren.length > 0 ? mappedChildren : undefined,
    });

    return mappedNode ? [mappedNode] : [];
  });
}

function removeNodeFromTree<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  nodeId: string,
): { nodes: StoryNode<TData>[]; removed?: StoryNode<TData> } {
  let removed: StoryNode<TData> | undefined;
  const nextNodes: StoryNode<TData>[] = [];

  for (const node of nodes) {
    if (node.id === nodeId) {
      removed = node;
      continue;
    }

    const childResult = node.children
      ? removeNodeFromTree(node.children, nodeId)
      : { nodes: undefined, removed: undefined };

    if (childResult.removed) {
      removed = childResult.removed;
      nextNodes.push({
        ...node,
        children: childResult.nodes && childResult.nodes.length > 0 ? childResult.nodes : undefined,
      });
    } else {
      nextNodes.push(node);
    }
  }

  return { nodes: nextNodes, removed };
}

function insertNodeInTree<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  node: StoryNode<TData>,
  index: number | undefined,
  parentNodeId: string | undefined,
): { nodes: StoryNode<TData>[]; inserted: boolean } {
  if (!parentNodeId) {
    const insertIndex = clampInsertIndex(index, nodes.length);

    return {
      nodes: [...nodes.slice(0, insertIndex), node, ...nodes.slice(insertIndex)],
      inserted: true,
    };
  }

  let inserted = false;
  const nextNodes = nodes.map((candidate) => {
    if (candidate.id === parentNodeId) {
      inserted = true;
      const children = [...(candidate.children ?? [])];
      const insertIndex = clampInsertIndex(index, children.length);

      children.splice(insertIndex, 0, node);

      return {
        ...candidate,
        children,
      };
    }

    if (!candidate.children) {
      return candidate;
    }

    const childResult = insertNodeInTree(candidate.children, node, index, parentNodeId);
    if (childResult.inserted) {
      inserted = true;
      return {
        ...candidate,
        children: childResult.nodes,
      };
    }

    return candidate;
  });

  return { nodes: nextNodes, inserted };
}

function removeReferencesToNodeIds<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  removedNodeIds: ReadonlySet<string>,
) {
  return mapNodeTree(nodes, (node) => {
    const next = node.next && removedNodeIds.has(node.next) ? undefined : node.next;
    const choices = node.choices?.filter((choice) => !removedNodeIds.has(choice.target));

    return {
      ...node,
      next,
      choices: choices && choices.length > 0 ? choices : undefined,
    };
  });
}

function renameNodeReferences<TData extends StoryNodeData>(
  nodes: StoryNode<TData>[],
  from: string,
  to: string,
) {
  return mapNodeTree(nodes, (node) => ({
    ...node,
    id: node.id === from ? to : node.id,
    next: node.next === from ? to : node.next,
    choices: updateChoiceTargets(node.choices, from, to),
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
      const result = insertNodeInTree(story.nodes, patch.node, patch.index, patch.parentNodeId);

      if (!result.inserted && options.onMissing !== "ignore") {
        throw new Error(
          `Story "${story.id}" does not contain parent node "${patch.parentNodeId}".`,
        );
      }

      return {
        ...story,
        nodes: result.nodes,
      };
    }
    case "move-node": {
      const currentEntry = getStoryNodeEntries(story).find(
        (entry) => entry.nodeId === patch.nodeId,
      );
      if (!currentEntry) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      const targetParentEntry = patch.parentNodeId
        ? getStoryNodeEntries(story).find((entry) => entry.nodeId === patch.parentNodeId)
        : undefined;

      if (patch.parentNodeId && !targetParentEntry) {
        if (options.onMissing === "ignore") return story;
        throw new Error(
          `Story "${story.id}" does not contain parent node "${patch.parentNodeId}".`,
        );
      }

      if (
        patch.parentNodeId === patch.nodeId ||
        targetParentEntry?.ancestorNodeIds.includes(patch.nodeId)
      ) {
        throw new Error(`Cannot move story node "${patch.nodeId}" into itself or its descendants.`);
      }

      const targetLength = patch.parentNodeId
        ? (targetParentEntry?.node.children?.length ?? 0)
        : story.nodes.length;
      assertMoveTargetIndex(patch.index, targetLength, "Story node");
      const removedResult = removeNodeFromTree(story.nodes, patch.nodeId);
      if (!removedResult.removed) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      const insertResult = insertNodeInTree(
        removedResult.nodes,
        removedResult.removed,
        patch.index,
        patch.parentNodeId,
      );

      return {
        ...story,
        nodes: insertResult.nodes,
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
      const found = getStoryNodes(story).some((node) => node.id === patch.nodeId);
      if (!found) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      return {
        ...story,
        openingNodeId:
          story.openingNodeId === patch.nodeId ? patch.nextNodeId : story.openingNodeId,
        nodes: renameNodeReferences(story.nodes, patch.nodeId, patch.nextNodeId),
      };
    }
    case "remove-node": {
      const removeReferences = patch.removeReferences ?? true;
      const entry = getStoryNodeEntries(story).find(
        (candidate) => candidate.nodeId === patch.nodeId,
      );
      if (!entry) {
        if (options.onMissing === "ignore") return story;
        throw new Error(`Story "${story.id}" does not contain node "${patch.nodeId}".`);
      }

      const removedNodeIds = new Set(getNodeAndDescendantIds(entry.node));
      const removalResult = removeNodeFromTree(story.nodes, patch.nodeId);
      const remainingNodes = removalResult.nodes;
      const remainingStoryNodeCount = getStoryNodes({ ...story, nodes: remainingNodes }).length;
      if (
        removedNodeIds.has(story.openingNodeId) &&
        remainingStoryNodeCount > 0 &&
        !patch.nextOpeningNodeId
      ) {
        throw new Error(
          `Removing opening node "${patch.nodeId}" requires nextOpeningNodeId for story "${story.id}".`,
        );
      }

      const nodes = removeReferences
        ? removeReferencesToNodeIds(remainingNodes, removedNodeIds)
        : remainingNodes;

      return {
        ...story,
        openingNodeId: removedNodeIds.has(story.openingNodeId)
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
