import type {
  StoryDocument,
  StoryNode,
  StoryNodeData,
  StoryNodeTreeEntry,
  StoryState,
} from "./story-model";

export function getStoryNodeEntries<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(story: StoryDocument<TData, TState>): StoryNodeTreeEntry<TData, TState>[] {
  const entries: StoryNodeTreeEntry<TData, TState>[] = [];

  const visit = (
    node: StoryNode<TData, TState>,
    indexPath: number[],
    path: string,
    ancestorNodeIds: string[],
    parentNodeId?: string,
  ) => {
    const entry: StoryNodeTreeEntry<TData, TState> = {
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

export function getStoryNodes<TData extends StoryNodeData, TState extends StoryState = StoryState>(
  story: StoryDocument<TData, TState>,
): StoryNode<TData, TState>[] {
  return getStoryNodeEntries(story).map((entry) => entry.node);
}

export function createStoryNodeLookup<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(story: StoryDocument<TData, TState>): Map<string, StoryNode<TData, TState>> {
  return new Map(getStoryNodeEntries(story).map((entry) => [entry.nodeId, entry.node] as const));
}

export function createStoryNodeEntryLookup<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(story: StoryDocument<TData, TState>): Map<string, StoryNodeTreeEntry<TData, TState>> {
  return new Map(getStoryNodeEntries(story).map((entry) => [entry.nodeId, entry] as const));
}

export function getStoryNodeEntry<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(story: StoryDocument<TData, TState>, nodeId: string): StoryNodeTreeEntry<TData, TState> {
  const entry = createStoryNodeEntryLookup(story).get(nodeId);

  if (!entry) {
    throw new Error(`Story "${story.id}" does not contain node "${nodeId}".`);
  }

  return entry;
}

function getNextSiblingEntry<TData extends StoryNodeData, TState extends StoryState = StoryState>(
  entries: StoryNodeTreeEntry<TData, TState>[],
  entry: StoryNodeTreeEntry<TData, TState>,
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

function getParentEntry<TData extends StoryNodeData, TState extends StoryState = StoryState>(
  entries: StoryNodeTreeEntry<TData, TState>[],
  entry: StoryNodeTreeEntry<TData, TState>,
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

export function getImplicitStoryContinuationTarget<
  TData extends StoryNodeData,
  TState extends StoryState = StoryState,
>(story: StoryDocument<TData, TState>, node: StoryNode<TData, TState>): string | undefined {
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
