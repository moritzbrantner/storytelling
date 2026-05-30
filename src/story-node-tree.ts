import type { StoryDocument, StoryNode, StoryNodeData, StoryNodeTreeEntry } from "./story-model";

export function getStoryNodeEntries<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
): StoryNodeTreeEntry<TData>[] {
  const entries: StoryNodeTreeEntry<TData>[] = [];

  const visit = (
    node: StoryNode<TData>,
    indexPath: number[],
    path: string,
    ancestorNodeIds: string[],
    parentNodeId?: string,
  ) => {
    const entry: StoryNodeTreeEntry<TData> = {
      node,
      nodeId: node.id,
      parentNodeId,
      ancestorNodeIds,
      depth: ancestorNodeIds.length,
      index: entries.length,
      indexPath,
      path,
    };

    entries.push(entry);

    node.children?.forEach((child, childIndex) => {
      visit(
        child,
        [...indexPath, childIndex],
        `${path}.children.${childIndex}`,
        [...ancestorNodeIds, node.id],
        node.id,
      );
    });
  };

  story.nodes.forEach((node, nodeIndex) => {
    visit(node, [nodeIndex], `nodes.${nodeIndex}`, [], undefined);
  });

  return entries;
}

export function getStoryNodes<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
): StoryNode<TData>[] {
  return getStoryNodeEntries(story).map((entry) => entry.node);
}

export function createStoryNodeLookup<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
): Map<string, StoryNode<TData>> {
  return new Map(getStoryNodeEntries(story).map((entry) => [entry.nodeId, entry.node] as const));
}

export function createStoryNodeEntryLookup<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
): Map<string, StoryNodeTreeEntry<TData>> {
  return new Map(getStoryNodeEntries(story).map((entry) => [entry.nodeId, entry] as const));
}

export function getStoryNodeEntry<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  nodeId: string,
): StoryNodeTreeEntry<TData> {
  const entry = createStoryNodeEntryLookup(story).get(nodeId);

  if (!entry) {
    throw new Error(`Story "${story.id}" does not contain node "${nodeId}".`);
  }

  return entry;
}

function getNextSiblingEntry<TData extends StoryNodeData>(
  entries: StoryNodeTreeEntry<TData>[],
  entry: StoryNodeTreeEntry<TData>,
) {
  const siblingIndexPath = [...entry.indexPath];
  const lastIndex = siblingIndexPath[siblingIndexPath.length - 1];

  if (lastIndex === undefined) {
    return undefined;
  }

  siblingIndexPath[siblingIndexPath.length - 1] = lastIndex + 1;

  return entries.find(
    (candidate) =>
      candidate.indexPath.length === siblingIndexPath.length &&
      candidate.indexPath.every((value, index) => value === siblingIndexPath[index]),
  );
}

function getParentEntry<TData extends StoryNodeData>(
  entries: StoryNodeTreeEntry<TData>[],
  entry: StoryNodeTreeEntry<TData>,
) {
  const parentIndexPath = entry.indexPath.slice(0, -1);

  if (parentIndexPath.length === 0) {
    return undefined;
  }

  return entries.find(
    (candidate) =>
      candidate.indexPath.length === parentIndexPath.length &&
      candidate.indexPath.every((value, index) => value === parentIndexPath[index]),
  );
}

export function getImplicitStoryContinuationTarget<TData extends StoryNodeData>(
  story: StoryDocument<TData>,
  node: StoryNode<TData>,
): string | undefined {
  if (node.children?.[0]) {
    return node.children[0].id;
  }

  if (node.next) {
    return node.next;
  }

  const entries = getStoryNodeEntries(story);
  let currentEntry = entries.find((entry) => entry.node === node);

  while (currentEntry?.parentNodeId) {
    const nextSibling = getNextSiblingEntry(entries, currentEntry);
    if (nextSibling) {
      return nextSibling.nodeId;
    }

    const parentEntry = getParentEntry(entries, currentEntry);
    if (parentEntry?.node.next) {
      return parentEntry.node.next;
    }

    currentEntry = parentEntry;
  }

  return undefined;
}
